
import EventDispatcher from "../core/EventDispatcher";

class ClientNetwork extends EventDispatcher {

	constructor( props = {} ) {

		super();

		this.protocol = props.protocol || "ws";
		this.host = props.host || "localhost";
		this.port = props.port || 8081;
		this.app = props.app;

		this.connect();

	}

	connect() {

		this.socket = new WebSocket( `${this.protocol}://${this.host}:${this.port}` );

		this.socket.addEventListener( "message", e => {

			e = JSON.parse( e.data, this.reviver );

			if ( typeof e === "number" ) {

				this.app.officialTime = e;
				this.app.dispatchEvent( { type: "sync", time: e }, true );

			} else if ( e instanceof Array ) {

				console.log( e );

				for ( let i = 0; i < e.length; i ++ ) {

					if ( this.app && e[ i ].time ) {

						this.app.time = e[ i ].time;
						this.app.officialTime = e[ i ].time;

					}
					console.log( e[ i ] );
					this.app.dispatchEvent( e[ i ], true );

				}

			} else {

				console.log( e );

				if ( this.app && e.time ) {

					this.app.time = e.time;
					this.app.officialTime = e.time;

				}

				this.app.dispatchEvent( e, true );

			}

		} );

		this.socket.addEventListener( "open", () => this.dispatchEvent( "open" ) );
		this.socket.addEventListener( "close", () => this.onClose() );

	}

	onClose() {

		this.dispatchEvent( "close" );

		if ( this.autoReconnect ) this.connect();

	}

	send( data ) {

		data = JSON.stringify( data, this.replacer );

		this.socket.send( data );

	}

}

export default ClientNetwork;
