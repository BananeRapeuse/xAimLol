// ==UserScript==
// @name         xAimLol
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Get Wallhack, Aimbot, ESP and Wireframe. Press M, N and T to toggle them.
// @author       Ph0qu3_111
// @match        *://1v1.lol/*
// @match        *://1v1.school/*
// @icon         https://www.google.com/s2/favicons?domain=1v1.lol
// @grant        none
// @run-at       document-start
// @require      https://cdn.jsdelivr.net/npm/lil-gui@0.19
// @license The Unlisence
// ==/UserScript==
const isSchoolLink = window.location.hostname.indexOf( '1v1.school' ) > - 1;

const searchSize = 300;
const threshold = 4.5;

const settings = {
	aimbot: false,
	aimbotSpeed: 0.15,
	esp: true,
	wireframe: true,
	createdBy: 'Ph0qu3_111',
    IfStuckOn17Percent: 'refresh the page (F5)',
	showHelp() {

		dialogEl.style.display = dialogEl.style.display === '' ? 'none' : '';

	}
};

let gui;

function initGui() {

	gui = new lil.GUI();

	const controllers = {};
	for ( const key in settings ) {

		controllers[ key ] = gui.add( settings, key ).name( fromCamel( key ) ).listen();

	}
	controllers.aimbotSpeed.min( 0.05 ).max( 0.5 ).step( 0.01 );
	controllers.createdBy.disable();

}

function fromCamel( text ) {

	const result = text.replace( /([A-Z])/g, ' $1' );
	return result.charAt( 0 ).toUpperCase() + result.slice( 1 );

}

const WebGL = WebGL2RenderingContext.prototype;

HTMLCanvasElement.prototype.getContext = new Proxy( HTMLCanvasElement.prototype.getContext, {
	apply( target, thisArgs, args ) {

		if ( args[ 1 ] ) {

			args[ 1 ].preserveDrawingBuffer = true;

		}

		return Reflect.apply( ...arguments );

	}
} );

WebGL.shaderSource = new Proxy( WebGL.shaderSource, {
	apply( target, thisArgs, args ) {

		let [ shader, src ] = args;

		if ( src.indexOf( 'gl_Position' ) > - 1 ) {

			if ( src.indexOf( 'OutlineEnabled' ) > - 1 ) {

				shader.isPlayerShader = true;

			}

			src = src.replace( 'void main', `

				out float vDepth;
				uniform bool enabled;
				uniform float threshold;

				void main

			` ).replace( /return;/, `

				vDepth = gl_Position.z;

				if ( enabled && vDepth > threshold ) {

					gl_Position.z = 1.0;

				}

			` );

		} else if ( src.indexOf( 'SV_Target0' ) > - 1 ) {

			src = src.replace( 'void main', `

				in float vDepth;
				uniform bool enabled;
				uniform float threshold;

				void main

			` ).replace( /return;/, `

				if ( enabled && vDepth > threshold ) {

					SV_Target0 = vec4( 1.0, 0.0, 0.0, 1.0 );

				}

			` );

		}

		args[ 1 ] = src;

		return Reflect.apply( ...arguments );

	}
} );

WebGL.attachShader = new Proxy( WebGL.attachShader, {
	apply( target, thisArgs, [ program, shader ] ) {

		if ( shader.isPlayerShader ) program.isPlayerProgram = true;

		return Reflect.apply( ...arguments );

	}
} );

WebGL.getUniformLocation = new Proxy( WebGL.getUniformLocation, {
	apply( target, thisArgs, [ program, name ] ) {

		const result = Reflect.apply( ...arguments );

		if ( result ) {

			result.name = name;
			result.program = program;

		}

		return result;

	}
} );

WebGL.uniform4fv = new Proxy( WebGL.uniform4fv, {
	apply( target, thisArgs, [ uniform ] ) {

		const name = uniform && uniform.name;

		if ( name === 'hlslcc_mtx4x4unity_ObjectToWorld' ||
			name === 'hlslcc_mtx4x4unity_ObjectToWorld[0]' ) {

			uniform.program.isUIProgram = true;

		}

		return Reflect.apply( ...arguments );

	}
} );

let movementX = 0, movementY = 0;
let count = 0;

let gl;

const handler = {
	apply( target, thisArgs, args ) {

		const program = thisArgs.getParameter( thisArgs.CURRENT_PROGRAM );

		if ( ! program.uniforms ) {

			program.uniforms = {
				enabled: thisArgs.getUniformLocation( program, 'enabled' ),
				threshold: thisArgs.getUniformLocation( program, 'threshold' )
			};

		}

		const couldBePlayer = ( isSchoolLink || program.isPlayerProgram ) && args[ 1 ] > 3000;

		program.uniforms.enabled && thisArgs.uniform1i( program.uniforms.enabled, ( settings.esp || settings.aimbot ) && couldBePlayer );
		program.uniforms.threshold && thisArgs.uniform1f( program.uniforms.threshold, threshold );

		args[ 0 ] = settings.wireframe && ! program.isUIProgram && args[ 1 ] > 6 ? thisArgs.LINES : args[ 0 ];

		if ( couldBePlayer ) {

			gl = thisArgs;

		}

		Reflect.apply( ...arguments );

	}
};

WebGL.drawElements = new Proxy( WebGL.drawElements, handler );
WebGL.drawElementsInstanced = new Proxy( WebGL.drawElementsInstanced, handler );

window.requestAnimationFrame = new Proxy( window.requestAnimationFrame, {
	apply( target, thisArgs, args ) {

		args[ 0 ] = new Proxy( args[ 0 ], {
			apply() {

				update();

				return Reflect.apply( ...arguments );

			}
		} );

		return Reflect.apply( ...arguments );

	}
} );

function update() {

	const isPlaying = document.querySelector( 'canvas' ).style.cursor === 'none';
	rangeEl.style.display = isPlaying && settings.aimbot ? '' : 'none';

	if ( settings.aimbot && gl ) {

		const width = Math.min( searchSize, gl.canvas.width );
		const height = Math.min( searchSize, gl.canvas.height );

		const pixels = new Uint8Array( width * height * 4 );

		const centerX = gl.canvas.width / 2;
		const centerY = gl.canvas.height / 2;

		const x = Math.floor( centerX - width / 2 );
		const y = Math.floor( centerY - height / 2 );

		gl.readPixels( x, y, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels );

		for ( let i = 0; i < pixels.length; i += 4 ) {

			if ( pixels[ i ] === 255 && pixels[ i + 1 ] === 0 && pixels[ i + 2 ] === 0 && pixels[ i + 3 ] === 255 ) {

				const idx = i / 4;

				const dx = idx % width;
				const dy = ( idx - dx ) / width;

				movementX += ( x + dx - centerX );
				movementY += - ( y + dy - centerY );

				count ++;

			}

		}

	}

	if ( count > 0 && isPlaying ) {

		const f = settings.aimbotSpeed / count;

		movementX *= f;
		movementY *= f;

		window.dispatchEvent( new MouseEvent( 'mousemove', { movementX, movementY } ) );

		rangeEl.classList.add( 'range-active' );

	} else {

		rangeEl.classList.remove( 'range-active' );

	}

	movementX = 0;
	movementY = 0;
	count = 0;

	gl = null;

}

const el = document.createElement( 'div' );

el.innerHTML = `<style>

.dialog {
	position: absolute;
	left: 50%;
	top: 50%;
	padding: 20px;
	background: #1e294a;
	color: #fff;
	transform: translate(-50%, -50%);
	text-align: center;
	z-index: 999999;
	font-family: cursive;
}

.dialog * {
	color: #fff;
}

.close {
	position: absolute;
	right: 5px;
	top: 5px;
	width: 20px;
	height: 20px;
	opacity: 0.5;
	cursor: pointer;
}

.close:hover {
	opacity: 1;
}

.range {
	position: absolute;
	left: 50%;
	bottom: 50px;
	width: 120px;
	height: 6px;
	background: #000;
	border: 2px solid #fff;
	transform: translateX( -50% );
	z-index: 99999;
	opacity: 0.5;
}

.range-active {
	opacity: 1 !important;
}

.range span {
	position: absolute;
	left: 50%;
	top: -8px;
	font-size: 14px;
	transform: translateX( -50% );
}

</style>
<div class="range" style="display: none;"><span>Aimbot</span></div>
<div class="dialog" id="esp-dialog" style="display: none;">

<h2>1v1.LOL Aimbot & ESP</h2>
<p>Press M, N and T to toggle them</p>

<div class="close" onclick="this.parentElement.style.display = 'none';">x</div>
</div>`;

document.body.appendChild( el );

const dialogEl = document.getElementById( 'esp-dialog' );
const rangeEl = document.querySelector( '.range' );

window.addEventListener( 'keydown', ( { keyCode } ) => {

	switch ( keyCode ) {

		case 77: return settings.aimbot = ! settings.aimbot; // M
		case 78: return settings.esp = ! settings.esp; // N
		case 84: return settings.wireframe = ! settings.wireframe; // T

	}

} );

initGui();
