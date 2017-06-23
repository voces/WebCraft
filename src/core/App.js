
// Actually used by App
import EventDispatcher from "./EventDispatcher.js";
import Terrain from "../entities/Terrain.js";
import ditto from "./ditto.js";
import Collection from "./Collection.js";
import Unit from "../entities/Unit.js";
import fetchFile from "../misc/fetchFile.js";
import ServerNetwork from "../networks/ServerNetwork.js";
import ClientNetwork from "../networks/ClientNetwork.js";
import models from "../entities/models.js";
import * as env from "../misc/env.js";

import * as rts from "../presets/rts.js";

// Wrapped by App
import * as tweens from "../tweens/tweens.js";
import Rect from "../misc/Rect.js";

const eval2 = eval;

class App extends EventDispatcher {

	constructor( props = {} ) {

		super();

		this.time = 0;
		this.lastNow = Date.now();

		this.players = props.players || new Collection();
		this.units = props.units || new Collection();
		this.updates = props.updates || new Collection();
		this.subevents = props.subevents || [];
		this.rects = props.rects || new Collection();

		this.initTerrain( props.terrain );
		this.initIntentSystem( props.intentSystem );
		this.initScene( props.scene );

		if ( props.network === undefined ) props.network = {};

		if ( props.network.reviver === undefined )
			props.network.reviver = ( key, value ) => {

				if ( typeof value !== "object" || value._collection === undefined || value._key === undefined ) return value;

				// console.log( value._collection, value._key );

				return this[ value._collection ].dict[ value._key ];

			};

		if ( props.network.replacer === undefined )
			props.network.replacer = ( key, value ) => value;

		this.eventSystem = Object.assign( {}, rts.eventSystem, props.eventSystem );

		if ( env.isServer ) {

			this.initServerNetwork( props.network );
			this.renderer = props.renderer && props.renderer.constructor !== Object ? props.renderer : ditto();

			this.addEventListener( "clientJoin", e => this.eventSystem.clientJoinHandler( this, e ) );
			this.addEventListener( "clientLeave", e => this.eventSystem.clientLeaveHandler( this, e ) );
			this.addEventListener( "clientMessage", e => this.eventSystem.clientMessageHandler( this, e ) );

		} else {

			this.initClientNetwork( props.network );
			this.initCamera( props.camera );
			this.renderer = props.renderer && props.renderer.constructor !== Object ? props.renderer : App.defaultRenderer( props.renderer );

			window.addEventListener( "resize", () => this.camera.resize() );
			window.addEventListener( "keydown", e => this.intentSystem.keydown && this.intentSystem.keydown( e ) );
			window.addEventListener( "keyup", e => this.intentSystem.keyup && this.intentSystem.keyup( e ) );

			this.addEventListener( "localPlayer", e => this.eventSystem.localPlayerHandler( this, e ) );

		}

		this.addEventListener( "playerJoin", e => this.eventSystem.playerJoinHandler( this, e ) );

		for ( const tween in tweens )
			this[ tween ] = obj => tweens[ tween ]( Object.assign( { startTime: this.time }, obj ) );

		const app = this;

		this.Rect = class extends Rect {

			constructor( ...args ) {

				super( ...args );

				if ( this.app === undefined ) this.app = app;

				this.addEventListener( "dirty", () => ( console.log( "dirty" ), app.updates.add( this ) ) );
				this.addEventListener( "clean", () => app.updates.remove( this ) );

			}

		};

		if ( props.types ) this.loadTypes( props.types );

		this.update();

	}

	static defaultRenderer() {

		const renderer = new THREE.WebGLRenderer( { antialias: true } );
		renderer.shadowMap.enabled = true;
		renderer.shadowMap.type = THREE.PCFSoftShadowMap;

		renderer.setSize( window.innerWidth, window.innerHeight );

		if ( document.readyState === "complete" || document.readyState === "loaded" || document.readyState === "interactive" )
			document.body.appendChild( renderer );

		else document.addEventListener( "DOMContentLoaded", () => document.body.appendChild( renderer.domElement ) );

		return renderer;

	}

	initTerrain( props ) {

		this.terrain = props && props.constructor !== Object ? props : new Terrain( Object.assign( { app: this }, props ) );

	}

	initIntentSystem( props ) {

		this.intentSystem = props && props.constructor !== Object ? props : {};

	}

	initScene( props ) {

		this.scene = props && props instanceof THREE.Scene ?
			props :
			new THREE.Scene();

		// this.globalLight = new THREE.HemisphereLight( 0xffffbb, 0x080820 );
		this.globalLight = new THREE.HemisphereLight( 0xffffbb, 0x080820 );
		this.scene.add( this.globalLight );

		this.sun = new THREE.DirectionalLight( 0xffffff, 0.5 );
		this.sun.position.z = 5;
		this.sun.position.x = - 3;
		this.sun.position.y = - 7;
		this.scene.add( this.sun );

	}

	initCamera( props ) {

		this.camera = props && props instanceof THREE.Camera ?
			props :
			new THREE.PerspectiveCamera( 50, window.innerWidth / window.innerHeight, 0.1, 10000 );

		// this.camera.resize = () => this.camera.aspect = window.innerWidth / window.innerHeight;
		this.camera.resize = () => {

			this.camera.aspect = window.innerWidth / window.innerHeight;
			this.camera.updateProjectionMatrix();

			this.renderer.setSize( window.innerWidth, window.innerHeight );

		};

		this.camera.position.z = 25;

	}

	initServerNetwork( props = {} ) {

		this.network = props.constructor !== Object ?
			props :
			new ServerNetwork( Object.assign( { players: this.players }, props ) );

		this.network.app = this;
		this.network.reviver = props.reviver;
		this.network.replacer = props.replacer;

	}

	initClientNetwork( props = {} ) {

		this.network = props && props.constructor !== Object ?
			props :
			new ClientNetwork( props );

		this.network.app = this;
		this.network.reviver = props.reviver || App.defaultReviver();
		this.network.replacer = props.replacer || App.defaultReplacer();

	}

	loadTypes( types ) {

		if ( types.units ) this.loadUnitTypes( types.units );

	}

	loadUnitTypes( types ) {

		for ( let i = 0; i < types.length; i ++ )
			this.loadUnitType( types[ i ] );

	}

	loadUnitType( type ) {

		const app = this;

		if ( models[ type.model ] === undefined ) {

			models[ type.model ] = new EventDispatcher();
			fetchFile( type.model )
				.then( file => {

					const eventDispatcher = models[ type.model ];

					models[ type.model ] = eval2( file );

					eventDispatcher.dispatchEvent( { type: "ready", model: models[ type.model ] } );

				} )
				.catch( err => console.error( err ) );

		}

		this[ type.name ] = class extends Unit {

			constructor( props ) {

				super( Object.assign( { app }, type, props ) );

				app.units.add( this );

				this.addEventListener( "meshLoaded", () => app.scene.add( this.mesh ) );
				this.addEventListener( "meshUnloaded", () => app.scene.remove( this.mesh ) );
				this.addEventListener( "dirty", () => app.updates.add( this ) );
				this.addEventListener( "clean", () => app.updates.remove( this ) );

			}

		};

		Object.defineProperty( this[ type.name ].constructor, "name", { value: type.name, configurable: true } );

	}

	dispatchEvent( event, received ) {

		if ( ( env.isClient || event.networked ) && this.network )
			this.network.send( event );

		super.dispatchEvent( event, received );

	}

	update() {

		const now = Date.now(),
			delta = now - this.lastNow;

		this.lastNow = now;
		this.time += delta;

		for ( let i = 0; i < this.updates.length; i ++ )
			if ( typeof this.updates[ i ] === "function" ) this.updates[ i ]( this.time );
			else if ( typeof this.updates[ i ] === "object" ) {

				if ( this.updates[ i ].update ) this.updates[ i ].update( this.time );
				else if ( this.updates[ i ].updates )
					for ( let n = 0; n < this.updates[ i ].updates.length; n ++ )
						this.uodates[ i ].updates[ n ]( this.time );

			}

		if ( this.subevents.length ) {

			const oldTime = this.time;

			this.subevents.sort( ( a, b ) => a.time - b.time );

			if ( env.isServer ) this.network.send( this.subevents );

			for ( let i = 0; i < this.subevents.length; i ++ ) {

				if ( this.subevents[ i ].time ) this.time = this.subevents[ i ].time;

				if ( this.subevents[ i ].target ) this.subevents[ i ].target.dispatchEvent( this.subevents[ i ] );
				else this.dispatchEvent( this.subevents[ i ] );

			}

			this.time = oldTime;
			this.subevents = [];

		}

		if ( env.isClient ) {

			this.renderer.render( this.scene, this.camera );
			requestAnimationFrame( () => this.update() );

		} else {

			// this.network.send( this.time );
			setTimeout( () => this.update(), 1000 / 60 );

		}

	}

}

export default App;
