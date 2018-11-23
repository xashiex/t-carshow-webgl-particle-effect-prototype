var ForcePoint = function(x, y, z, radius, force) {
	this.pos = new THREE.Vector3( x, y, z );
	this.radius = radius;
	this.forceOrg = force;
	this.force = force;
}
ForcePoint.prototype = {
	getAcceleration: function(particle) {
		var dist = this.pos.distanceTo(particle);
		var exp = (dist < this.radius) ? 0 : Math.pow(dist, -2);
		var a = new THREE.Vector3();
		a.subVectors(particle, this.pos);
		return a.multiplyScalar(this.force * exp);
	},
	reset: function() {
		this.force = this.forceOrg;
	}
}

var Particle = function(ix, iy, orgX, orgY, orgZ) {
	this.ix = ix;
	this.iy = iy;
	this.org = new THREE.Vector3( orgX, orgY, orgZ );
	this.now = new THREE.Vector3( orgX, orgY, orgZ );
	this.velocity = new THREE.Vector3( 0., 0., 0. );
	this.target = new THREE.Vector3( orgX, orgY, orgZ );
	this.color = new THREE.Color( 1., 1., 1. );
	this.alpha = 0;
	this.delay = this.org.distanceTo(new THREE.Vector3( 0, 0, 0 )) / 1000 + Math.random() * 0.5;
	this.timeShift = Math.random() * Math.PI * 2;
	this.random = Math.random();
	this.complete = true;
}
Particle.prototype = {
	changeStatus: function(status) {
		this.complete = false;
		switch(status){
			case 'ready':
				this.setReady();		
				break;
			case 'flyin':
				this.setFlyin();
				break;
			case 'spread':
				this.setSpread();
				break;
			case 'flyout':
				this.setFlyout();
				break;
		}
	},
	setReady: function() {
		this.alpha = 0;
		this.now.x = (Math.random() < 0.5 ) ? ParticleModel.boundary.left - Math.abs(this.org.x) : ParticleModel.boundary.right + Math.abs(this.org.x);
		this.now.y = ParticleModel.boundary.middle + 0.001 * (this.org.y - ParticleModel.boundary.middle) * this.org.x;
		this.now.z = Math.random2(200);
		this.target.copy(this.now);
	},
	setFlyin: function() {
		this.alpha = 0;
		var dy = (this.now.x < 0) ? -10000 : 10000;
		var baseDis = 1000;
		this.target = new THREE.Vector3( Math.random2(baseDis), ParticleModel.boundary.middle + dy + Math.random2(baseDis), Math.random2(baseDis) );
		this.velocity = new THREE.Vector3();
		this.velocity.subVectors(this.target, this.now).multiplyScalar(0.001);
	},
	setSpread: function() {
		this.alpha = ParticleModel.MAX_ALPHA;
		// this.target = this.org.clone();
	},
	setFlyout: function() {
		this.alpha = ParticleModel.MAX_ALPHA;
		this.target = new THREE.Vector3( 0, ParticleModel.boundary.bottom - 200, 0 );
	},
	update: function(dt) {
		switch(ParticleModel.status){
			case 'flyin':
				this.updateOnFlyin(dt);		
				break;
			case 'spread':
				this.updateOnSpread(dt);
				break;
			case 'flyout':
				this.updateOnFlyout(dt);
				break;
		}
	},
	updateOnReady: function(dt) {

	},
	updateOnFlyin: function(dt) {
		if (ParticleModel.time > this.delay) {
			this.alpha = Math.min(this.alpha + dt * 1, ParticleModel.MAX_ALPHA);
			var a = ParticleModel.forcePoint.getAcceleration(this.now);
			this.velocity.sub(a);
			this.now.add(this.velocity);
			// if (this.ix == 0 && this.iy == 0) {
			// 	console.log(this.alpha);
			// };
		};
	},
	updateOnSpread: function(dt) {
		if (ParticleModel.time < 1) {
			var a = ParticleModel.forcePoint.getAcceleration(this.now);
			this.velocity.sub(a);
		} else {
			this.target = this.org.clone();
			this.velocity.subVectors(this.target, this.now).multiplyScalar(0.1);
		}

		this.complete = (this.velocity.length() < 0.1);
		
		this.now.add(this.velocity);
	},
	updateOnFlyout: function(dt) {
		if (ParticleModel.time > this.delay && this.now.y > this.target.y) {
			var x = Math.random2(10);
			var z = Math.random2(10);
			var c = new THREE.Vector3( x, this.now.y, z );
			// var dist = this.now.distanceTo(c);
			var dyp = (this.now.y - (this.target.y + 50)) / (ParticleModel.height * 1.2);
			if (dyp < 0) dyp = 0.;
			// var dRadius = (dyp <= 0) ? 0 : (1 - dyp) * dt * 8;
			var dTheta = this.random * dt * 15;
			var r = Math.pow(dyp, 3) * 2000 + this.random * 100 * dyp;
			var v = new THREE.Vector3();
			v.subVectors(this.now, c).normalize().multiplyScalar(r);
			v.applyAxisAngle(ParticleModel.axisY, dTheta);
			v.add(c);
			if (ParticleModel.time > this.delay * 1.2) {
				v.add(new THREE.Vector3( 0, -dt * Math.pow(1 - dyp, 0.5) * 4000, 0 ));
			};
			this.now.copy(v);
		}
	}
}

var ParticleModel = {
	MAX_ALPHA: 0.9,
	status: '', // 'ready', 'flyin', 'spread', 'flyout'.
	np: 0,
	width: 0,
	height: 0,
	size: 0,
	nx: 0,
	ny: 0,
	boundary: {
		left: 0,
		right: 0,
		top: 0,
		bottom: 0
	},
	particles: null,
	positions: null,
	colors: null,
	alphas: null,
	forcePoint: null,
	time: 0,
	axisY: new THREE.Vector3( 0, 1, 0 ),
	completeTime: null,
	init: function(viewW, viewH, size) {
		var nx = Math.floor(viewW / size);
		var ny = Math.floor(viewH / size);
		var w_2 = 0.5 * viewW;
		var h_2 = 0.5 * viewH;
		var np = nx * ny;
		var particles = [];
		var px, py;
		for (var j = 0; j < ny; j++) {
			py = viewH - j * size;
			for (var i = 0; i < nx; i++) {
				px = -w_2 + i * size;
				particles.push(new Particle(i, j, px, py, 0));
			};
		};
		ParticleModel.np = np;
		ParticleModel.width = viewW;
		ParticleModel.height = viewH;
		ParticleModel.size = size;
		ParticleModel.nx = nx;
		ParticleModel.ny = ny;
		ParticleModel.boundary = {
			left: -w_2,
			right: w_2,
			top: viewH,
			bottom: 0,
			center: 0,
			middle: h_2
		};
		ParticleModel.particles = particles;
		ParticleModel.positions = new Float32Array( np * 3 );
		ParticleModel.colors = new Float32Array( np * 3 );
		ParticleModel.alphas = new Float32Array( np );
		ParticleModel.updatePositions();
		ParticleModel.updateColors();
		ParticleModel.updateAlphas();

		ParticleModel.forcePoint = new ForcePoint(ParticleModel.boundary.center, ParticleModel.boundary.middle, 0, 100, 2000);

		ParticleModel.changeStatus('ready');
	},
	changeStatus: function(status) {
		if (status == ParticleModel.status) return;
		console.log('status:', status);
		ParticleModel.time = 0;
		ParticleModel.status = status;
		switch(status){
			case 'ready':

				break;
			case 'flyin':
				createjs.Sound.play("flyin", {volume:guiParams.se_vol});
				ParticleModel.forcePoint.reset();
				break;
			case 'flyout':
				createjs.Sound.play("flyout", {volume:guiParams.se_vol});
				break;
		}
		for (var i = 0; i < ParticleModel.particles.length; i++) {
			ParticleModel.particles[i].changeStatus(status);
		};
	},
	updateParticles: function(dt) {
		ParticleModel.time += dt;
		if (ParticleModel.status == 'spread') {
			ParticleModel.forcePoint.force -= dt * 2000;
			if (ParticleModel.forcePoint.force < 0) ParticleModel.forcePoint.force = 0;
		}
		
		for (var i = 0; i < ParticleModel.particles.length; i++) {
			ParticleModel.particles[i].update(dt);
		};
	},
	updatePositions: function() {
		var positions = ParticleModel.positions;
		var p;
		for (var i = 0; i < ParticleModel.np; i++) {
			p = ParticleModel.particles[i];
			positions[i * 3 + 0] = p.now.x;
			positions[i * 3 + 1] = p.now.y;
			positions[i * 3 + 2] = p.now.z;
		};
	},
	updateColors: function() {
		var colors = ParticleModel.colors;
		var p;
		for (var i = 0; i < ParticleModel.np; i++) {
			p = ParticleModel.particles[i];
			colors[i * 3 + 0] = p.color.r;
			colors[i * 3 + 1] = p.color.g;
			colors[i * 3 + 2] = p.color.b;
		};
	},
	updateAlphas: function() {
		var alphas = ParticleModel.alphas;
		var p;
		for (var i = 0; i < ParticleModel.np; i++) {
			p = ParticleModel.particles[i];
			alphas[i] = p.alpha;
		};
	},
	checkComplete: function() {
		for (var i = 0; i < ParticleModel.np; i++) {
			p = ParticleModel.particles[i];

			if (!p.complete) {
				ParticleModel.completeTime = null;
				return false;
			}
		};
		return true;
	}
}

var Bubble = function(x, y, z) {
	this.position = new THREE.Vector3( x, y, z );
	this.random = Math.random();
}
Bubble.prototype = {
	update: function(time) {
		var theta = (this.random + time) / (1 + this.random) * Math.PI * 2;
		var v = new THREE.Vector3( Math.cos(theta), 0.5 + this.random, Math.sin(theta));
		v.multiply(new THREE.Vector3( 1, 8, 0 ));
		this.position.add(v);
		this.position.x = this.setLimit(this.position.x, -BubbleModel.width_2, BubbleModel.width_2, BubbleModel.width);
		this.position.y = this.setLimit(this.position.y, -BubbleModel.height_2, BubbleModel.height_2, BubbleModel.height);
		this.position.z = this.setLimit(this.position.z, -BubbleModel.width_2, BubbleModel.width_2, BubbleModel.width);
	},
	setLimit: function(v, min, max, length) {
		if (v < min) {
			v += length;
		} else if (v > max) {
			v -= length;
		}
		return v;
	}
}

var BubbleModel = {
	width: 0,
	height: 0,
	width_2: 0,
	height_2: 0,
	size: 0,
	N: 100,
	bubbles: [],
	position: null,
	init: function(viewW, viewH, size) {
		BubbleModel.width = viewW;
		BubbleModel.height = viewH;
		BubbleModel.width_2 = 0.5 * viewW;
		BubbleModel.height_2 = 0.5 * viewH;
		BubbleModel.size = size;
		var bubbles = [];
		for (var i = 0; i < BubbleModel.N; i++) {
			bubbles.push(new Bubble(Math.random2(BubbleModel.width_2), Math.random2(BubbleModel.height_2), Math.random2(BubbleModel.width_2 )));
		};
		BubbleModel.bubbles = bubbles;

		BubbleModel.positions = new Float32Array( BubbleModel.N * 3 );
		BubbleModel.updatePositions();
	},
	updateBubbles: function(time) {
		for (var i = 0; i < BubbleModel.bubbles.length; i++) {
			BubbleModel.bubbles[i].update(time);
		};
	},
	updatePositions: function() {
		var b;
		for (var i = 0; i < BubbleModel.bubbles.length; i++) {
			b = BubbleModel.bubbles[i];
			BubbleModel.positions[i * 3 + 0] = b.position.x;
			BubbleModel.positions[i * 3 + 1] = b.position.y;
			BubbleModel.positions[i * 3 + 2] = b.position.z;
		};
	}
}