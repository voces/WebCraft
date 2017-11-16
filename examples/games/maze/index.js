
/////////////////////////////////////////////////
///// Overhead
////////////////////////////////////////////////

/* globals Multiboard Chat */

{

	const isBrowser = new Function( "try {return this===window;}catch(e){ return false;}" )();

	// For Node (i.e., servers)
	if ( ! isBrowser ) {

		THREE = require( "three" );
		WebCraft = require( "../../../build/webcraft.js" );
		Multiboard = require( "../../shared/ui/Multiboard.js" );
		Chat = require( "../../shared/ui/Chat.js" );

	}

}

/////////////////////////////////////////////////
///// Initialization
////////////////////////////////////////////////

const keyboard = {};

const SIZE = 0.6;

const app = new WebCraft.App( {

	network: { host: "notextures.io", port: 8086 },

	types: {
		doodads: [
			{ name: "Green", model: { path: "../../models/Cube.js", color: "#B5FEB4" } },
			{ name: "TileWhite", model: { path: "../../models/Cube.js", color: "#F7F7FF" } },
			{ name: "TileGray", model: { path: "../../models/Cube.js", color: "#E6E6FF" } }
		],
		units: [
			{ name: "Character", model: { path: "../../models/Cube.js", scale: SIZE }, speed: 3.5 },
			{ name: "Food", model: { path: "../../models/Sphere.js", color: "#FFFF00", scale: 0.5 } },
			{ name: "Enemy", model: { path: "../../models/Sphere.js", color: "#0000FF", scale: 0.5 }, speed: 7 }
		]
	}
} );

app.state = { players: app.players, units: app.units, doodads: app.doodads, levelIndex: 0 };

const multiboard = new Multiboard( {
	columns: 2,
	schema: [ "color.name", "points" ],
	colors: app.Player.colors.map( color => color.hex )
} );

new Chat( app );

/////////////////////////////////////////////////
///// Game Logic
/////////////////////////////////////////////////

function spawn( player ) {

	const char = new app.Character( Object.assign( { owner: player, z: 1 }, levels[ app.state.levelIndex ].checkpoints[ player.checkpoint ].center ) );
	player.character = char;
	char.onNear( app.units, SIZE, onNear );
	char.addEventListener( "death", onDeath );

}

function cleanup() {

	const units = [ ...app.units ];
	for ( let i = 0; i < units.length; i ++ )
		units[ i ].remove();

	const doodads = [ ...app.doodads ];
	for ( let i = 0; i < doodads.length; i ++ )
		doodads[ i ].remove();

	for ( let i = 0; i < app.players.length; i ++ )
		app.players[ i ].food = [];

}

function start() {

	cleanup();

	// app.state.levelIndex = ( app.state.levelIndex + 1 ) % levels.length;
	app.state.levelIndex = Math.floor( app.random() * levels.length );

	const level = levels[ app.state.levelIndex ];

	if ( level.checkpoints === undefined ) calculateCheckpoints();

	const base = {};
	if ( level.speed ) base.speed = level.speed;

	for ( let i = 0; i < app.players.length; i ++ ) {

		app.players[ i ].checkpoint = level.spawn;
		spawn( app.players[ i ] );

	}

	for ( let y = 0; y < level.floormap.length; y ++ )
		for ( let x = 0; x < level.floormap[ y ].length; x ++ ) {

			const tile = level.floormap[ y ][ x ];

			const klass = tile === "░" ? app.Green :
				tile === " " ? ( ( x + y ) % 2 === 0 ? app.TileWhite : app.TileGray ) : undefined;

			if ( ! klass ) continue;

			new klass( tileToWorld( x, y ) );

		}

	if ( level.patrols )
		for ( let i = 0; i < level.patrols.length; i ++ ) {

			const unit = new app.Enemy( Object.assign( { z: 1 }, base, offset( level.patrols[ i ][ 0 ] ) ) );
			unit.patrol( level.patrols[ i ].map( p => offset( p ) ) );

		}

	if ( level.circles )
		for ( let i = 0; i < level.circles.length; i ++ ) {

			const center = offset( level.circles[ i ] );

			const unit = new app.Enemy( Object.assign( { z: 1 }, base, center ) );
			unit.circle = {
				radius: level.circles[ i ].radius || 1,
				duration: level.circles[ i ].duration || 1,
				center,
				offset: level.circles[ i ].offset || 0
			};
			unit.state = [ "circle" ];

		}

	if ( level.food )
		for ( let i = 0; i < level.food.length; i ++ )
			Object.assign( new app.Food( Object.assign( { z: 1 }, level.food[ i ], offset( level.food[ i ] ) ) ), { food: i } );

	if ( WebCraft.isBrowser ) app.camera.position.z = Math.max( level.width / 2 + 10, level.height );

	app.updates.push( tick );

}

function onDeath() {

	const player = this.owner;
	const level = levels[ app.state.levelIndex ];

	for ( let i = 0; i < player.food.length; i ++ )
		if ( player.food[ i ] )
			Object.assign( new app.Food( Object.assign( { z: 1 }, level.food[ i ], offset( level.food[ i ] ) ) ), { food: i } );

	player.food = [];

	this.remove();

	spawn( player );

}

function onNear( e ) {

	const character = e.target;
	const player = character.owner;

	for ( let i = 0; i < e.nears.length; i ++ )
		if ( e.nears[ i ] instanceof app.Enemy ) character.kill();
		else if ( e.nears[ i ] instanceof app.Food ) {

			player.food[ e.nears[ i ].food ] = true;
			e.nears[ i ].remove();

		}

}

let lastTime;
function tick( time ) {

	const level = levels[ app.state.levelIndex ];
	if ( ! level ) return;

	const delta = ( time - lastTime ) / 1000;
	lastTime = time;

	for ( let i = 0; i < app.players.length; i ++ )
		if ( app.players[ i ].character ) {

			const player = app.players[ i ];

			const xDelta = ( ( player.ArrowRight ? 1 : 0 ) - ( player.ArrowLeft ? 1 : 0 ) ) * player.character.speed * delta;
			const yDelta = ( ( player.ArrowUp ? 1 : 0 ) - ( player.ArrowDown ? 1 : 0 ) ) * player.character.speed * delta;

			if ( ! xDelta && ! yDelta ) continue;

			if ( xDelta !== 0 && canPlace( player.character, xDelta, 0 ) ) player.character.x = roundTo( player.character.x + xDelta, 4 );
			if ( yDelta !== 0 && canPlace( player.character, 0, yDelta ) ) player.character.y = roundTo( player.character.y + yDelta, 4 );

			for ( let n = 0; n < level.checkpoints.length; n ++ )
				if ( level.checkpoints[ n ].contains( player.character ) ) {

					player.checkpoint = n;

					if ( level.score !== n ) continue;

					if ( level.won === undefined ||
							typeof level.won === "number" && player.food.filter( food => food ).length >= level.won ||
							typeof level.won === "function" && level.won( player ) )

						point( player );

				}

		}

	const circles = app.units.filter( u => u instanceof app.Enemy && u.circle );
	for ( let i = 0; i < circles.length; i ++ ) {

		const info = circles[ i ].circle;

		circles[ i ].x = info.center.x + Math.cos( - 2 * Math.PI * ( time / 1000 + info.offset ) / info.duration ) * info.radius;
		circles[ i ].y = info.center.y + Math.sin( - 2 * Math.PI * ( time / 1000 + info.offset ) / info.duration ) * info.radius;

	}

}

function point( player ) {

	app.updates.splice( app.updates.indexOf( tick ), 1 );

	++ player.points;
	multiboard.update( app.players );

	start();

}

/////////////////////////////////////////////////
///// Server Events
/////////////////////////////////////////////////

function newPlayer( player ) {

	player.food = [];
	player.state = [ "character", "points", "checkpoint" ];
	if ( ! player.points ) player.points = 0;

	if ( app.players.length === 1 ) start();
	else {

		if ( player.character === undefined ) spawn( player );
		if ( player === app.localPlayer ) app.updates.push( tick );

	}

	++ multiboard.rows;
	multiboard.update( app.players );

}

app.addEventListener( "playerJoin", ( { player } ) => {

	newPlayer( player );

} );

app.addEventListener( "state", ( { state } ) => {

	for ( let i = 0; i < state.players.length; i ++ )
		newPlayer( state.players[ i ] );

} );

app.addEventListener( "playerLeave", ( { player } ) => {

	if ( player.character ) {

		player.character.remove();
		delete player.character;

	}

	player.remove();

	-- multiboard.rows;
	multiboard.update( app.players );

	if ( app.players.length === 0 )
		cleanup();

} );

/////////////////////////////////////////////////
///// Player Actions
/////////////////////////////////////////////////

app.addEventListener( "keydown", ( { direction, player } ) => player[ direction ] = true );
app.addEventListener( "keyup", ( { direction, player } ) => player[ direction ] = false );

WebCraft.isBrowser && window.addEventListener( "keydown", e => {

	if ( keyboard[ e.key ] ) return;
	keyboard[ e.key ] = true;

	if ( [ "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight" ].indexOf( e.key ) === - 1 ) return;

	app.network.send( { type: "keydown", direction: e.key } );

} );

WebCraft.isBrowser && window.addEventListener( "keyup", e => {

	if ( ! keyboard[ e.key ] ) return;
	keyboard[ e.key ] = false;

	if ( [ "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight" ].indexOf( e.key ) === - 1 ) return;

	app.network.send( { type: "keyup", direction: e.key } );

} );

/////////////////////////////////////////////////
///// Levels
/////////////////////////////////////////////////

const levels = [

	// Level 1
	{
		spawn: 0,
		score: 1,
		floormap: [
			"██████████████████████",
			"██░░░██████████  ░░░██",
			"██░░░█          █░░░██",
			"██░░░█          █░░░██",
			"██░░░█          █░░░██",
			"██░░░█          █░░░██",
			"██░░░  ██████████░░░██",
			"██████████████████████"
		],
		patrols: [
			[ { x: - 4.5, y: - 1.5 }, { x: 4.5, y: - 1.5 } ],
			[ { x: 4.5, y: - 0.5 }, { x: - 4.5, y: - 0.5 } ],
			[ { x: - 4.5, y: 0.5 }, { x: 4.5, y: 0.5 } ],
			[ { x: 4.5, y: 1.5 }, { x: - 4.5, y: 1.5 } ]
		]
	},

	// Level 2
	{
		spawn: 0,
		score: 1,
		speed: 6,
		won: 1,
		floormap: [
			"████████████████████",
			"████            ████",
			"████            ████",
			"█░░░            ░░░█",
			"█░░░            ░░░█",
			"████            ████",
			"████            ████",
			"████████████████████"
		],
		patrols: [
			[ { x: - 5.5, y: - 2.5 }, { x: - 5.5, y: 2.5 } ],
			[ { x: - 4.5, y: 2.5 }, { x: - 4.5, y: - 2.5 } ],
			[ { x: - 3.5, y: - 2.5 }, { x: - 3.5, y: 2.5 } ],
			[ { x: - 2.5, y: 2.5 }, { x: - 2.5, y: - 2.5 } ],
			[ { x: - 1.5, y: - 2.5 }, { x: - 1.5, y: 2.5 } ],
			[ { x: - 0.5, y: 2.5 }, { x: - 0.5, y: - 2.5 } ],
			[ { x: 0.5, y: - 2.5 }, { x: 0.5, y: 2.5 } ],
			[ { x: 1.5, y: 2.5 }, { x: 1.5, y: - 2.5 } ],
			[ { x: 2.5, y: - 2.5 }, { x: 2.5, y: 2.5 } ],
			[ { x: 3.5, y: 2.5 }, { x: 3.5, y: - 2.5 } ],
			[ { x: 4.5, y: - 2.5 }, { x: 4.5, y: 2.5 } ],
			[ { x: 5.5, y: 2.5 }, { x: 5.5, y: - 2.5 } ]
		],
		food: [ { x: 0, y: 0 } ]
	},

	// Level 3
	{
		origin: { x: 0, y: - 0.5 },
		spawn: 0,
		score: 0,
		floormap: [
			"██████",
			"█ ████",
			"█    █",
			"█ ░░ █",
			"█ ░░ █",
			"█    █",
			"██████"
		],
		speed: 4,
		patrols: [
			[ { x: - 1.5, y: 1.5 }, { x: 1.5, y: 1.5 }, { x: 1.5, y: - 1.5 }, { x: - 1.5, y: - 1.5 } ],
			[ { x: 1.5, y: 1.5 }, { x: 1.5, y: - 1.5 }, { x: - 1.5, y: - 1.5 }, { x: - 1.5, y: 1.5 } ],
			[ { x: 1.5, y: - 1.5 }, { x: - 1.5, y: - 1.5 }, { x: - 1.5, y: 1.5 }, { x: 1.5, y: 1.5 } ],
			[ { x: - 1.5, y: - 1.5 }, { x: - 1.5, y: 1.5 }, { x: 1.5, y: 1.5 }, { x: 1.5, y: - 1.5 } ],
			[ { x: - 0.5, y: 1.5 }, { x: 1.5, y: 1.5 }, { x: 1.5, y: - 1.5 }, { x: - 1.5, y: - 1.5 }, { x: - 1.5, y: 1.5 } ],
			[ { x: 0.5, y: 1.5 }, { x: 1.5, y: 1.5 }, { x: 1.5, y: - 1.5 }, { x: - 1.5, y: - 1.5 }, { x: - 1.5, y: 1.5 } ],
			[ { x: 1.5, y: 0.5 }, { x: 1.5, y: - 1.5 }, { x: - 1.5, y: - 1.5 }, { x: - 1.5, y: 1.5 }, { x: 1.5, y: 1.5 } ],
			[ { x: 1.5, y: - 0.5 }, { x: 1.5, y: - 1.5 }, { x: - 1.5, y: - 1.5 }, { x: - 1.5, y: 1.5 }, { x: 1.5, y: 1.5 } ],
			[ { x: 0.5, y: - 1.5 }, { x: - 1.5, y: - 1.5 }, { x: - 1.5, y: 1.5 }, { x: 1.5, y: 1.5 }, { x: 1.5, y: - 1.5 } ],
			[ { x: - 0.5, y: - 1.5 }, { x: - 1.5, y: - 1.5 }, { x: - 1.5, y: 1.5 }, { x: 1.5, y: 1.5 }, { x: 1.5, y: - 1.5 } ]],
		food: [ { x: - 1.5, y: 2.5 } ],
		won: player => player.food.filter( food => food ).length >= 1
	},

	// Level 4
	{
		origin: { x: 1.5, y: - 1.5 },
		spawn: 0,
		score: 1,
		won: 3,
		floormap: [
			"█████████████",
			"███████░░████",
			"███████░░████",
			"███████░░████",
			"██████    ███",
			"█████      ██",
			"████        █",
			"█░░░        █",
			"█░░░        █",
			"████        █",
			"█████      ██",
			"██████    ███",
			"█████████████"
		],
		patrols: [[ { x: 0, y: 0 } ]],
		circles: [].concat( ...[ 0, 0.25, 0.5, 0.75 ].map( offset => [ 0.5, 1, 1.5, 2, 2.5, 3, 3.5 ].map( radius => ( {
			x: 0, y: 0, radius, duration: 3.25, offset: 3.25 * offset
		} ) ) ) ),
		food: [
			{ x: 0, y: 3 },
			{ x: 3, y: 0 },
			{ x: 0, y: - 3 }
		]
	},

	// Level 5
	{
		origin: { x: 0.5, y: 0 },
		spawn: 0,
		score: 3,
		floormap: [
			"███████████████████",
			"█░░              ░█",
			"████████████████ ██",
			"█░             █ ██",
			"███ ██████████ █ ██",
			"███ █       ░█ █ ██",
			"███ █ █     ░█ █ ██",
			"███ █ ████████ █ ██",
			"███ █          █ ██",
			"███ ████████████ ██",
			"███              ██",
			"███████████████████"
		],
		circles: [].concat( ...[ 0, 0.25, 0.5, 0.75 ].map( offset => [ 0.25, 0.5, 0.75, 1 ].map( radius => ( {
			x: 0, y: 0, radius: radius * 7.5, duration: 5, offset: 5 * offset
		} ) ) ) )
	},

	// Level 6
	{
		origin: { x: 1, y: 0 },
		spawn: 0,
		score: 2,
		floormap: [
			"████████████████████",
			"█░░                █",
			"█░░                █",
			"███                █",
			"███                █",
			"███████████████░░░░█",
			"███████████████░░░░█",
			"███                █",
			"███                █",
			"█░░                █",
			"█░░                █",
			"████████████████████"
		],
		patrols: [].concat( ...[ - 5.75, - 1.917, 1.917, 5.75 ].map( x => [ 3, - 3 ].map( y => [ { x, y } ] ) ) ),
		circles: [].concat( ...[ - 5.75, - 1.917, 1.917, 5.75 ].map( x => [].concat( ...[ 3, - 3 ].map( y => [].concat( ...[ 0, 0.25, 0.5, 0.75 ].map( arm => [ 0.95, 1.9 ].map( radius => ( {
			x, y: y, radius, duration: 4, offset: 4 * arm
		} ) ) ) ) ) ) ) ),
		food: [
			{ x: - 7.5, y: - 1.5 },
			{ x: - 3.5, y: - 1.5 },
			{ x: 0.5, y: - 1.5 },
			{ x: 4.5, y: - 1.5 }
		],
		won: 4
	},

	// Level 7
	{
		spawn: 0,
		score: 1,
		speed: 8,
		won: 4,
		floormap: [
			"████████████████████",
			"████            ████",
			"████            ████",
			"████            ████",
			"█░░░            ░░░█",
			"█░░░            ░░░█",
			"████            ████",
			"████            ████",
			"████            ████",
			"████████████████████"
		],
		patrols: [
			[ { x: - 5.5, y: - 3.5 }, { x: - 5.5, y: 3.5 } ],
			[ { x: - 4.5, y: 3.5 }, { x: - 4.5, y: - 3.5 } ],
			[ { x: - 3.5, y: - 3.5 }, { x: - 3.5, y: 3.5 } ],
			[ { x: - 2.5, y: 3.5 }, { x: - 2.5, y: - 3.5 } ],
			[ { x: - 1.5, y: - 3.5 }, { x: - 1.5, y: 3.5 } ],
			[ { x: - 0.5, y: 3.5 }, { x: - 0.5, y: - 3.5 } ],
			[ { x: 0.5, y: - 3.5 }, { x: 0.5, y: 3.5 } ],
			[ { x: 1.5, y: 3.5 }, { x: 1.5, y: - 3.5 } ],
			[ { x: 2.5, y: - 3.5 }, { x: 2.5, y: 3.5 } ],
			[ { x: 3.5, y: 3.5 }, { x: 3.5, y: - 3.5 } ],
			[ { x: 4.5, y: - 3.5 }, { x: 4.5, y: 3.5 } ],
			[ { x: 5.5, y: 3.5 }, { x: 5.5, y: - 3.5 } ]
		],
		food: [
			{ x: - 5.5, y: 3.5 },
			{ x: - 5.5, y: - 3.5 },
			{ x: 5.5, y: 3.5 },
			{ x: 5.5, y: - 3.5 }
		]
	},

	// Level 8
	{
		origin: { x: - 1, y: 0 },
		spawn: 0,
		score: 1,
		speed: 4,
		won: 3,
		floormap: [
			"██████████████",
			"█    ██    ███",
			"█ ░█    ██ ███",
			"█ ██ ██ ██ ███",
			"█    ██    ███",
			"█ ██ ██ ██ ░░█",
			"█ ██ ██ ██ ░░█",
			"█    ██    ███",
			"█ ██ ██ ██ ███",
			"█ ██    ██ ███",
			"█    ██    ███",
			"██████████████"
		],
		patrols: [
			...[ { x: - 3, y: 3 }, { x: - 3, y: 0 }, { x: - 3, y: - 3 } ].map( offset => [
				{ x: offset.x - 1.5, y: offset.y + 1.5 },
				{ x: offset.x + 1.5, y: offset.y + 1.5 },
				{ x: offset.x + 1.5, y: offset.y - 1.5 },
				{ x: offset.x - 1.5, y: offset.y - 1.5 } ] ),
			...[ { x: 3, y: 3 }, { x: 3, y: 0 }, { x: 3, y: - 3 } ].map( offset => [
				{ x: offset.x + 1.5, y: offset.y + 1.5 },
				{ x: offset.x - 1.5, y: offset.y + 1.5 },
				{ x: offset.x - 1.5, y: offset.y - 1.5 },
				{ x: offset.x + 1.5, y: offset.y - 1.5 } ] ),
			[ { x: - 1.5, y: 3.5 }, { x: 1.5, y: 3.5 }, { x: 1.5, y: - 3.5 }, { x: - 1.5, y: - 3.5 } ]
		],
		food: [
			{ x: - 4.5, y: - 4.5 },
			{ x: 4.5, y: 4.5 },
			{ x: 4.5, y: - 4.5 }
		]
	},

	// Level 9
	{
		origin: { x: 0, y: 0 },
		spawn: 0,
		score: 1,
		speed: 1,
		won: 1,
		floormap: [
			"████████████████████",
			"█░░██      ██      █",
			"█░░██      ██      █",
			"█      ██  ██  ██  █",
			"█      ██  ██  ██  █",
			"█  ██████  ██  ██░░█",
			"█  ██████  ██  ██░░█",
			"█  ██    ░░    █████",
			"█  ██    ░░    █████",
			"█      ██████      █",
			"█      ██████      █",
			"████████████████████"
		],
		patrols: [
			[ { x: - 6, y: 2.5 } ],
			[ { x: - 4.5, y: 4 } ],
			[ { x: - 2, y: 3.5 } ],
			[ { x: - 0.5, y: 2 } ],
			[ { x: - 7.5, y: 0 } ],
			[ { x: - 8.5, y: - 2 } ],
			[ { x: - 6, y: - 3.5 } ],
			[ { x: - 4.5, y: - 2 } ],
			[ { x: - 3, y: - 1.5 } ],
			[ { x: 3.5, y: 0 } ],
			[ { x: 4.5, y: 2 } ],
			[ { x: 6, y: 3.5 } ],
			[ { x: 7.5, y: 2 } ],
			[ { x: 3.5, y: - 4 } ],
			...[
				{ x: 0, y: 4 }, { x: 4, y: 4 }, { x: 8, y: 4 },
				{ x: - 8, y: 2 }, { x: - 4, y: 2 },
				{ x: 4, y: - 2 },
				{ x: - 8, y: - 4 }, { x: - 4, y: - 4 }
			].map( offset => [
				{ x: offset.x - 0.5, y: offset.y + 0.5 },
				{ x: offset.x + 0.5, y: offset.y + 0.5 },
				{ x: offset.x + 0.5, y: offset.y - 0.5 },
				{ x: offset.x - 0.5, y: offset.y - 0.5 } ] ),
			[ { x: - 0.5, y: - 0.5 }, { x: 0.5, y: - 0.5 }, { x: 0.5, y: 2 }, { x: 0.5, y: - 0.5 } ],
			[ { x: 4.5, y: - 3.5 }, { x: 7, y: - 3.5 }, { x: 7, y: - 4.5 }, { x: 7, y: - 3.5 } ]
		],
		food: [ { x: 8, y: - 4 } ]
	}

];

// app.state.levelIndex = levels.length - 2;

for ( let i = 0; i < levels.length; i ++ ) {

	levels[ i ].height = levels[ i ].floormap.length;
	levels[ i ].width = levels[ i ].floormap.reduce( ( width, row ) => Math.max( width, row.length ), - Infinity );

}

/////////////////////////////////////////////////
///// Misc
/////////////////////////////////////////////////

function tileToWorld( x, y ) {

	return {
		x: x - Math.floor( levels[ app.state.levelIndex ].width / 2 ) + ( levels[ app.state.levelIndex ].width % 2 === 0 ? 0.5 : 0 ),
		y: - y + Math.floor( levels[ app.state.levelIndex ].height / 2 ) - ( levels[ app.state.levelIndex ].height % 2 === 0 ? 0.5 : 0 )
	};

}

function worldToTile( x, y ) {

	return {
		x: x + Math.floor( levels[ app.state.levelIndex ].width / 2 ) - ( levels[ app.state.levelIndex ].width % 2 === 0 ? 0.5 : 0 ),
		y: - ( y - Math.floor( levels[ app.state.levelIndex ].height / 2 ) + ( levels[ app.state.levelIndex ].height % 2 === 0 ? 0.5 : 0 ) )
	};

}

function roundTo( value, decimals = 0 ) {

	decimals = Math.pow( 10, decimals );

	return Math.round( value * decimals ) / decimals;

}

function canPlace( character, xDelta = 0, yDelta = 0 ) {

	const corners = [
		worldToTile( roundTo( character.x + xDelta + SIZE / 2, 4 ), roundTo( character.y + yDelta + SIZE / 2, 4 ) ),
		worldToTile( roundTo( character.x + xDelta + SIZE / 2, 4 ), roundTo( character.y + yDelta - SIZE / 2, 4 ) ),
		worldToTile( roundTo( character.x + xDelta - SIZE / 2, 4 ), roundTo( character.y + yDelta + SIZE / 2, 4 ) ),
		worldToTile( roundTo( character.x + xDelta - SIZE / 2, 4 ), roundTo( character.y + yDelta - SIZE / 2, 4 ) )
	];

	return ! corners.some( corner => levels[ app.state.levelIndex ].floormap[ Math.round( corner.y ) ][ Math.round( corner.x ) ] === "█" );

}

function offset( point ) {

	const level = levels[ app.state.levelIndex ];

	return { x: point.x + ( level.origin ? level.origin.x || 0 : 0 ), y: point.y + ( level.origin ? level.origin.y || 0 : 0 ) };

}

function calculateCheckpoints() {

	const level = levels[ app.state.levelIndex ];
	const grid = Array( level.floormap.length ).fill( 0 ).map( () => [] );

	level.checkpoints = [];

	for ( let y = 0; y < level.floormap.length; y ++ )
		for ( let x = 0; x < level.floormap[ y ].length; x ++ ) {

			const tile = level.floormap[ y ][ x ];

			if ( tile !== "░" || grid[ y ][ x ] ) continue;

			const topLeft = tileToWorld( x, y );
			topLeft.x -= 0.5;
			topLeft.y += 0.5;

			let tX = x;
			let tY = y;

			while ( level.floormap[ y ][ tX + 1 ] === "░" ) tX ++;
			while ( level.floormap[ tY + 1 ][ tX ] === "░" ) tY ++;

			const bottomRight = tileToWorld( tX, tY );
			bottomRight.x += 0.5;
			bottomRight.y -= 0.5;

			level.checkpoints.push( new app.Rect( topLeft, bottomRight ) );

			for ( let ttY = y; ttY <= tY; ttY ++ )
				for ( let ttX = x; ttX <= tX; ttX ++ )
					grid[ ttY ][ ttX ] = true;

		}

}
