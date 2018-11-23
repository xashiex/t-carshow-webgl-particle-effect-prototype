var gui, guiParams;

$(function() {
  var VIEW_W = 1080,
    VIEW_H = 1920;
  var webcams = [];
  var renderer,
    camera,
    scene,
    particlesGeometry,
    particlesMaterial,
    particleSystem,
    bubblesGeometry,
    bubblesMaterial,
    bubblesSystem;
  var bgCamera, bgScene;

  function init() {
    // initWebcam();
    // initSounds();
    loadFiles();
  }

  function loadFiles() {
    var queue = new createjs.LoadQueue();
    queue.installPlugin(createjs.Sound);
    queue.on("progress", function(e) {
      $(".loading").html("LOADING... " + Math.floor(e.progress * 100) + "%");
    });
    queue.on(
      "complete",
      function(e) {
        $(".loading").hide();
        $(".howto").show();
        createjs.Sound.play("game_bgm");
        createjs.Sound.play("bubbles", { loop: -1 });
        initWebcam();
      },
      this
    );
    queue.loadManifest([
      {
        id: "game_bgm",
        src: "sounds/20151201_MiraiEvent_GameMU_Only.mp3",
      },
      {
        id: "bubbles",
        src: "sounds/20151130_MiraiEvent_OOH_SE_Game_BGS.mp3",
      },
      {
        id: "flyin",
        src: "sounds/20151130_MiraiEvent_OOH_SE_Game_WaterUp.mp3",
      },
      {
        id: "flyout",
        src: "sounds/20151130_MiraiEvent_OOH_SE_Game_WaterDown.mp3",
      },
    ]);
  }

  function initWebcam() {
    // navigator.mediaDevices = navigator.mediaDevices || ((navigator.mozGetUserMedia || navigator.webkitGetUserMedia) ? {
    //    getUserMedia: function(c) {
    //      return new Promise(function(y, n) {
    //        (navigator.mozGetUserMedia ||
    //         navigator.webkitGetUserMedia).call(navigator, c, y, n);
    //      });
    //    }
    // } : null);
    // console.log(navigator.mediaDevices);
    navigator.getUserMedia =
      navigator.getUserMedia ||
      navigator.webkitGetUserMedia ||
      navigator.mozGetUserMedia;
    if (
      typeof MediaStreamTrack === "undefined" ||
      typeof MediaStreamTrack.getSources === "undefined"
    ) {
      alert("This browser does not support MediaStreamTrack.\n\nTry Chrome.");
      ready();
    } else {
      MediaStreamTrack.getSources(onGetMediaSources);
    }
  }

  function onGetMediaSources(sourceInfos) {
    webcams = [];
    var sourceInfo, label, id;
    for (var i = 0; i < sourceInfos.length; i++) {
      sourceInfo = sourceInfos[i];
      if (sourceInfo.kind === "video") {
        label =
          sourceInfo.label != ""
            ? sourceInfo.label
            : "camera " + (webcams.length + 1);
        webcams.push({
          label: label,
          id: sourceInfo.id,
        });
      }
    }
    $(".snap-btn").on("click", onSnapClick);
    ready();
  }

  function onSelWebcam(id) {
    var video = $("#webcam")[0];
    if (window.stream) {
      video.src = null;
      // window.stream.stop();
    }
    var constraints = {
      video: {
        optional: [
          {
            sourceId: id,
          },
        ],
      },
    };
    // navigator.mediaDevices.getUserMedia(constraints).then(function(stream) {
    navigator.getUserMedia(
      constraints,
      function(stream) {
        window.stream = stream; // make stream available to console
        video.src = window.URL.createObjectURL(stream);
        video.play();
      },
      function(error) {
        console.log("navigator.getUserMedia error: ", error);
      }
    );
  }

  function onSnapClick() {
    var webcam = $("#webcam")[0];
    console.log(webcam.videoWidth);
    drawImage(webcam, guiParams.rotate_webcam);
    guiParams.open_webcam = false;
    $(".video-w").hide();
  }

  function ready() {
    initGUI();

    ParticleModel.init(VIEW_W, VIEW_H, window.particleSize);
    BubbleModel.init(VIEW_W * 1.5, VIEW_H * 1.5, window.particleSize);
    initThree();
    // loadImage();
    window.addEventListener("resize", onResize);
    onResize();
  }

  function onResize() {
    if (renderer) {
      var w = window.innerWidth;
      var h = window.innerHeight;
      var scale = Math.min(w / VIEW_W, h / VIEW_H);
      renderer.setSize(VIEW_W * scale, VIEW_H * scale);
    }
  }

  function loadImage(url) {
    if (url == undefined) url = "images/photo2.jpg";
    var img = new Image();
    img.onload = function() {
      console.log("img.onload");
      $(".howto").hide();
      drawImage(img);
    };
    img.src = url;
    // if (img.complete) img.onload();
  }

  function drawImage(img, rot) {
    var nx = !rot ? ParticleModel.nx : ParticleModel.ny;
    var ny = !rot ? ParticleModel.ny : ParticleModel.nx;
    var imgW = img.width;
    var imgH = img.height;
    var scale = Math.max(nx / imgW, ny / imgH);
    var sw = nx / scale;
    var sh = ny / scale;
    var sx = 0.5 * (imgW - sw);
    var sy = 0.5 * (imgH - sh);

    var c = document.createElement("canvas");
    c.width = nx;
    c.height = ny;
    var imgCtx = c.getContext("2d");
    imgCtx.drawImage(img, sx, sy, sw, sh, 0, 0, nx, ny);

    setParticleColors(imgCtx, rot);
  }

  function setParticleColors(imgCtx, rot) {
    var nx = ParticleModel.nx;
    var ny = ParticleModel.ny;
    var count,
      cx,
      cy,
      z,
      cdata,
      color,
      lum,
      lumMin = 999,
      lumMax = -999,
      lumLen,
      p;
    var colors = [];
    for (var j = 0; j < ny; j++) {
      for (var i = 0; i < nx; i++) {
        cdata = !rot
          ? imgCtx.getImageData(i, j, 1, 1).data
          : imgCtx.getImageData(ny - j - 1, i, 1, 1).data;
        color = new THREE.Color(cdata[0] / 255, cdata[1] / 255, cdata[2] / 255);
        lum = color.getHSL().l;
        if (lum < lumMin) lumMin = lum;
        if (lum > lumMax) lumMax = lum;
        colors.push(color);
      }
    }

    // normalize lum
    lumLen = lumMax - lumMin;
    for (var j = 0; j < ny; j++) {
      for (var i = 0; i < nx; i++) {
        count = j * nx + i;
        color = colors[count];
        hue = color.getHSL().h;
        lum = (color.getHSL().l - lumMin) / lumLen;
        // color.setHSL(hue, 0, Math.pow(lum, 1));
        color.setHSL(hue, 0, Math.pow(lum, 0.5));
        // z = (Math.pow(color.getHSL().l, 2) - 0.25) * 500;
        z = (Math.pow(color.getHSL().l, 2) - 0.25) * 250;
        p = ParticleModel.particles[j * nx + i];
        p.org.z = z;
        p.color = color;
      }
    }

    ParticleModel.updateColors();
    ParticleModel.updatePositions();

    if (guiParams.autoPlay) {
      guiParams.status = "ready";
      ParticleModel.changeStatus("ready");
      autoPlay();
    }
  }

  function initGUI() {
    guiParams = {
      cameraZ: 3000,
      rotate: false,
      rotationY: -0.02 * Math.PI,
      status: "ready",
      default_image: function() {
        loadImage();
      },
      upload_image: function() {
        $("#myInput").click();
      },
      autoPlay: true,
    };

    gui = new dat.GUI();

    var f1 = gui.addFolder("view controls");

    var camZCtrl = f1.add(guiParams, "cameraZ", 1000, 6000);
    camZCtrl.onChange(function(v) {
      camera.position.z = v;
    });
    var rotateCtrl = f1.add(guiParams, "rotate");
    var rotationYCtrl = f1.add(guiParams, "rotationY", 0, 360).listen();
    rotationYCtrl.onChange(function(v) {
      scene.rotation.y = Math.deg2Rad(v);
    });
    var autoPlayCtrl = gui.add(guiParams, "autoPlay");
    var defaultImageCtrl = gui.add(guiParams, "default_image");
    var uploadImageCtrl = gui.add(guiParams, "upload_image");

    if (webcams.length > 0) {
      guiParams.open_webcam = false;

      var webcamFolder = gui.addFolder("webcam");
      webcamFolder.open();

      var webcamSelObj = {};
      for (var i = 0; i < webcams.length; i++) {
        webcamSelObj[webcams[i].label] = webcams[i].id;
      }
      guiParams.select_webcam = webcams[0].label;
      onSelWebcam(webcams[0].id);

      var webcamSelCtrl = webcamFolder.add(
        guiParams,
        "select_webcam",
        webcamSelObj
      );
      webcamSelCtrl.onFinishChange(function(v) {
        onSelWebcam(v);
      });
      var webcamOpenCtrl = webcamFolder.add(guiParams, "open_webcam").listen();
      webcamOpenCtrl.onChange(function(v) {
        console.log("open_webcam.onChange:", v);
        if (v) {
          $(".video-w").show();
        } else {
          $(".video-w").hide();
        }
      });

      guiParams.rotate_webcam = true;
      var webcamRot = webcamFolder.add(guiParams, "rotate_webcam");
      webcamRot.onChange(function(v) {
        console.log(guiParams.rotate_webcam);
        if (guiParams.rotate_webcam) {
          $("#webcam").addClass("rotate90");
        } else {
          $("#webcam").removeClass("rotate90");
        }
      });
      if (guiParams.rotate_webcam) {
        $("#webcam").addClass("rotate90");
      } else {
        $("#webcam").removeClass("rotate90");
      }
    }

    var soundFolder = gui.addFolder("sound");
    guiParams.se_vol = 1;
    soundFolder.add(guiParams, "se_vol", 0, 1);

    $("#myInput").on("change", function(e) {
      var $self = this;
      console.log("input.change");
      var reader = new FileReader();
      var file = e.target.files[0];
      reader.onloadend = function() {
        loadImage(reader.result);
        $self.value = null;
      };
      reader.readAsDataURL(file);
    });

    var statusCtrl = gui
      .add(guiParams, "status", ["ready", "flyin", "spread", "flyout"])
      .listen();
    statusCtrl.onFinishChange(function(v) {
      ParticleModel.changeStatus(v);
    });
  }

  function createTexture(type) {
    var type = type == undefined ? 1 : 2;
    // var color = '44, 250, 254';
    var color = "250, 236, 150";
    var canvas = document.createElement("canvas");
    canvas.width = canvas.height = 128;
    var context = canvas.getContext("2d");
    var gradient = context.createRadialGradient(
      canvas.width / 2,
      canvas.height / 2,
      0,
      canvas.width / 2,
      canvas.height / 2,
      canvas.width / 2
    );
    if (type == 1) {
      // gradient.addColorStop( 0, 'rgba(' + color + ',1)' );
      // gradient.addColorStop( 0.2, 'rgba(' + color + ',1)' );
      // gradient.addColorStop( 0.21, 'rgba(' + color + ',0.2)' );
      // gradient.addColorStop( 0.9, 'rgba(' + color + ',0)' );
      gradient.addColorStop(0, "rgba(" + color + ",1)");
      gradient.addColorStop(0.2, "rgba(" + color + ",1)");
      gradient.addColorStop(0.21, "rgba(" + color + ",0.2)");
      gradient.addColorStop(0.5, "rgba(" + color + ",0)");
    } else {
      gradient.addColorStop(0, "rgba(" + color + ",1)");
      gradient.addColorStop(0.4, "rgba(" + color + ",1)");
      gradient.addColorStop(0.5, "rgba(" + color + ",0.5)");
      gradient.addColorStop(0.75, "rgba(" + color + ",0)");
    }

    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);
    var texture = new THREE.Texture(canvas);
    texture.needsUpdate = true;
    return texture;
  }

  function initThree() {
    createBg();

    camera = new THREE.PerspectiveCamera(40, VIEW_W / VIEW_H, -2000, 2000);
    // camera.position.z = 2500;
    camera.position.z = guiParams.cameraZ;

    scene = new THREE.Scene();

    addParticleSystem();
    addBubblesSystem();

    renderer = new THREE.WebGLRenderer({
      antialias: false,
    });
    // renderer.setClearColor(0x064676);
    // renderer.setPixelRatio( window.devicePixelRatio );
    renderer.setSize(VIEW_W, VIEW_H);
    $("#particleContainer")[0].appendChild(renderer.domElement);

    stats = new Stats();
    stats.domElement.style.position = "absolute";
    stats.domElement.style.top = "0px";
    $("body")[0].appendChild(stats.domElement);

    clock = new THREE.Clock(true);

    animate();
  }

  function createBg() {
    var w = window.innerWidth;
    var h = window.innerHeight;
    bgCamera = new THREE.Camera();
    bgScene = new THREE.Scene();
    bgScene.add(bgCamera);

    var loader = new THREE.TextureLoader();
    loader.load(
      // 'images/partical_bg.jpg',
      "images/bg.jpg",
      function(texture) {
        var bg = new THREE.Mesh(
          new THREE.PlaneGeometry(2, 2, 0),
          new THREE.MeshBasicMaterial({ map: texture })
        );
        bg.material.depthTest = false;
        bg.material.depthWrite = false;
        bgScene.add(bg);
      }
    );
  }

  function addParticleSystem() {
    particlesGeometry = new THREE.BufferGeometry();
    particlesGeometry.addAttribute(
      "position",
      new THREE.BufferAttribute(ParticleModel.positions, 3)
    );
    particlesGeometry.addAttribute(
      "customColor",
      new THREE.BufferAttribute(ParticleModel.colors, 3)
    );
    particlesGeometry.addAttribute(
      "customAlpha",
      new THREE.BufferAttribute(ParticleModel.alphas, 1)
    );

    var ps = (window.particleRatio * window.innerHeight) / 1920;

    particlesMaterial = new THREE.ShaderMaterial({
      uniforms: {
        texture: { type: "t", value: createTexture() },
        time: { type: "f", value: 0 },
        // size: { type: 'f', value: ParticleModel.size * 1.9 }
        size: { type: "f", value: ParticleModel.size * ps },
      },
      vertexShader: document.getElementById("vshader").textContent,
      fragmentShader: document.getElementById("fshader").textContent,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthTest: false,
    });

    particleSystem = new THREE.Points(particlesGeometry, particlesMaterial);
    particleSystem.position.y = -0.5 * ParticleModel.boundary.top;
    scene.rotation.y = guiParams.rotationY;

    scene.add(particleSystem);
  }

  function addBubblesSystem() {
    bubblesGeometry = new THREE.BufferGeometry();
    bubblesGeometry.addAttribute(
      "position",
      new THREE.BufferAttribute(BubbleModel.positions, 3)
    );

    bubblesMaterial = new THREE.ShaderMaterial({
      uniforms: {
        texture: { type: "t", value: createTexture(2) },
        size: { type: "f", value: BubbleModel.size * 50 },
      },
      vertexShader: document.getElementById("bubble-vshader").textContent,
      fragmentShader: document.getElementById("bubble-fshader").textContent,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthTest: false,
    });

    bubblesSystem = new THREE.Points(bubblesGeometry, bubblesMaterial);
    // bubblesSystem.position.x = -0.5 * BubbleModel.width;
    // bubblesSystem.position.y = -0.5 * BubbleModel.height;
    // bubblesSystem.position.z = -0.5 * BubbleModel.width;
    // bubblesSystem.rotation.y = guiParams.rotationY;

    scene.add(bubblesSystem);
  }

  function animate() {
    requestAnimationFrame(animate);
    stats.update();

    var delta = clock.getDelta();
    var elapsedTime = clock.getElapsedTime();

    ParticleModel.updateParticles(delta);
    ParticleModel.updatePositions();
    ParticleModel.updateColors();
    ParticleModel.updateAlphas();

    particlesMaterial.uniforms.time.value = elapsedTime;
    particlesGeometry.attributes.position.needsUpdate = true;
    particlesGeometry.attributes.customColor.needsUpdate = true;
    particlesGeometry.attributes.customAlpha.needsUpdate = true;

    BubbleModel.updateBubbles(elapsedTime);
    BubbleModel.updatePositions();
    bubblesGeometry.attributes.position.needsUpdate = true;

    if (ParticleModel.status == "spread") {
      if (ParticleModel.checkComplete()) {
        if (!ParticleModel.completeTime)
          ParticleModel.completeTime = elapsedTime;
        particleSystem.rotation.y = Math.deg2Rad(
          Math.sin((elapsedTime - ParticleModel.completeTime) / 0.5) * 10
        );
      }
    } else {
      particleSystem.rotation.y += 0.05 * (0 - particleSystem.rotation.y);
    }

    if (guiParams.rotate) {
      scene.rotation.y += -0.01;
      guiParams.rotationY = Math.rad2Deg(particleSystem.rotation.y);
    }

    renderer.autoClear = false;
    renderer.clear();
    renderer.render(bgScene, bgCamera);
    renderer.render(scene, camera);
  }

  function autoPlay() {
    var readyTime = 3;
    var flyinTime = 2;
    var spreadTime = 5;
    var flyoutTime = 5;
    TweenMax.killDelayedCallsTo(autoPlay);
    if (guiParams.autoPlay) {
      switch (guiParams.status) {
        case "ready":
          guiParams.status = "flyin";
          ParticleModel.changeStatus("flyin");
          TweenMax.delayedCall(flyinTime, autoPlay);
          break;
        case "flyin":
          guiParams.status = "spread";
          ParticleModel.changeStatus("spread");
          TweenMax.delayedCall(spreadTime, autoPlay);
          break;
        case "spread":
          guiParams.status = "flyout";
          ParticleModel.changeStatus("flyout");
          TweenMax.delayedCall(flyoutTime, autoPlay);
          break;
        case "flyout":
          guiParams.status = "ready";
          ParticleModel.changeStatus("ready");
          TweenMax.delayedCall(readyTime, autoPlay);
          break;
      }
    }
  }

  init();
});
