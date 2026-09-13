import * as THREE from "three";

var canvas = document.getElementById("canvas");

var rad = 150;
var SHOW_DEBUG = false;

// Fixed-step simulation so motion is the same on 60 Hz and 144 Hz displays.
var FIXED_DT = 1 / 120;
var MAX_FRAME_DT = 0.05;
var MAX_STEPS = 8;

var GRAVITY = 2020;
var HIT_POWER = 15;
var MAX_SPEED = 4200 * HIT_POWER;
var AIR_DRAG = 0.06;
var CONTACT_FRICTION = 1.2;
var GROUND_FRICTION = 2.8;
var REST_SPEED = 48;
var REST_ALIGN = 8;
var BOUNCE_E = 0.7;

// How flat the ball looks at full compression. 0 = always a sphere, 0.4 = strong pancake.
var SQUASH_AMOUNT = 0.38;
var SQUASH_K = 720;
var SQUASH_C = 7.4;
var MAX_PEN = rad * 0.42;

var GRAB_K = 72;
var GRAB_DAMP = 13;
var POKE_SPEED = 680;
var HIT_LOOKBACK = 56;
var STROKE_FULL = 2400;
var STROKE_MIN = 48;
var STROKE_LOG = 420;
var STROKE_EASE = 1.85;
var STROKE_NDC_FULL = 0.82;
var STROKE_NDC_DEAD = 0.03;
var STROKE_NEAR_DIST = 2100;
var STROKE_FAR_COMP = 0.42;
var STROKE_FAR_MAX = 2.05;
var STROKE_AIM = 0.2;
var CONTACT_AIM = 0.38;
var STROKE_MIN_FORWARD = 0.93;
var STROKE_LIFT = 0.26;
var WRAP_SPIN = 1.62;
var WRAP_SIDE_SPIN = 1.55;
var STROKE_EDGE_POWER = 0.9;
var HIT_NOISE = 70;
// Fastest strike we expect (world units/s). Maps to a bounce near the top of the room.
var MAX_SLAM_CURSOR = 12000;
var BAT_SENSITIVITY = 0.04;
var BAT_MAX_NDC = 14;
var BAT_NOISE_NDC = 0.9;
var BAT_SPIN = 0.08;
var BALL_I = 0.4 * rad * rad;
var SPIN_FRICTION = 5.2;
var SPIN_AIR = 0.18;
var MAGNUS_MAX = 0.024;
var MAGNUS_AMOUNT = 0.4;
var MAGNUS = MAGNUS_MAX * MAGNUS_AMOUNT;
var BALL_WEIGHT = 0.25;
var HIT_SCALE = 1;
var MAX_OMEGA = 26;
var HIT_SPIN = 1;
var ROLL_IMPULSE = 380;

var BASE_ROOM_W = 2400;
var BASE_ROOM_D = 11000;
var BASE_ROOM_H = 1600;
var ARENA_SCALE = 1;
var ROOM_W = BASE_ROOM_W;
var ROOM_D = BASE_ROOM_D;
var ROOM_H = BASE_ROOM_H;
var WALL_LEFT = -ROOM_W / 2;
var WALL_RIGHT = ROOM_W / 2;
var WALL_FRONT = 1100;
var WALL_BACK = WALL_FRONT - ROOM_D;
var COURT_Z = (WALL_FRONT + WALL_BACK) / 2;
var PLAYER_SPAWN_X = 0;
var PLAYER_SPAWN_Y = 720;
var PLAYER_SPAWN_Z = WALL_FRONT - 420;
var WALL_VIS_H = 14000;
var lx = WALL_LEFT + rad;
var rx = WALL_RIGHT - rad;
var lz = WALL_BACK + rad;
var rz = WALL_FRONT - rad;
var restY = rad;
var MAX_BALLS = 100;
var BALL_COUNT = 1;
var SQUISHINESS = 0.55;

var ptr = new THREE.Vector3();
var prevPtr = new THREE.Vector3();
var ptrPath = [];
var ptrInitialized = false;
var ptrInside = false;
var grabbed = false;
var grabMoved = false;
var grabStartedAt = 0;
var leftDown = false;
var rightDown = false;
var overBall = false;
var lastPointerMoveAt = 0;
var charging = false;
var chargeFired = false;
var chargeOffset = new THREE.Vector3();
var strokeStart = new THREE.Vector3();
var strokeStartNdc = new THREE.Vector2();
var strokeLocked = false;

var balls = [];
var hoverBall = null;
var grabBall = null;
var chargeTarget = null;
var lastPlaneBall = null;

var _hitPlane = new THREE.Plane();
var _hitPoint = new THREE.Vector3();
var _ballHit = new THREE.Vector3();
var _chargeHit = new THREE.Vector3();
var _ndc = new THREE.Vector2();
var _ndcSample = new THREE.Vector2();
var _ray = new THREE.Raycaster();
var _swingRay = new THREE.Raycaster();
var _look = new THREE.Vector3();
var _tmpA = new THREE.Vector3();
var _tmpQ = new THREE.Quaternion();
var _axis = new THREE.Vector3();
var _swingFrom = new THREE.Vector3();
var _swingTo = new THREE.Vector3();
var _strokeFrom = new THREE.Vector3();
var _strokeTo = new THREE.Vector3();
var _strokeDir = new THREE.Vector3();
var _swingPlane = new THREE.Plane();
var _worldUp = new THREE.Vector3(0, 1, 0);
var _camRight = new THREE.Vector3();
var _camUp = new THREE.Vector3();
var _courtFwd = new THREE.Vector3();
var _camFwdFlat = new THREE.Vector3();
var _camRightFlat = new THREE.Vector3();

var camYaw = 0;
var camPitch = 0;
var camEyeY = 720;
var lastPointerClientX = 0;
var lastPointerClientY = 0;
var hasPointerClient = false;
var keys = Object.create(null);
var CAM_SPEED = 1680;
var CAM_SPRINT = 1.7;
var CAM_TURN = 1.55;
var CAM_DRAG_SENS = 0.001;
var CAM_PITCH_MIN = -1.2;
var CAM_PITCH_MAX = 1.15;
var CAM_WALK_Y = PLAYER_SPAWN_Y;
var CAM_JUMP_VEL = 1280;
var CAM_GRAVITY = GRAVITY;
var looking = false;
var camVelY = 0;
var camGrounded = true;

var scene;
var camera;
var renderer;
var puckMesh;
var chargeMarker;
var strokeLine;
var strokeMesh;
var debugGroup;
var light;
var fillLight;
var floorMesh;
var backWall;
var leftWall;
var rightWall;
var frontWall;
var ballGeometry;
var ballMaterial;
var shadowGeometry;
var shadowMaterial;

function applySquishiness(t) {
  SQUISHINESS = clamp(t, 0, 1);
  SQUASH_AMOUNT = lerp(0.08, 0.58, SQUISHINESS);
  SQUASH_K = lerp(1500, 240, SQUISHINESS);
  SQUASH_C = lerp(11, 4.2, SQUISHINESS);
  MAX_PEN = rad * lerp(0.2, 0.56, SQUISHINESS);
}

function applyBallWeight(t) {
  BALL_WEIGHT = clamp(t, 0, 1);
  if (BALL_WEIGHT <= 0.5) {
    var u = BALL_WEIGHT / 0.5;
    AIR_DRAG = lerp(0.2, 0.038, u);
    HIT_SCALE = lerp(0.35, 1, u);
  } else {
    var u = (BALL_WEIGHT - 0.5) / 0.5;
    AIR_DRAG = lerp(0.038, 0.012, u);
    HIT_SCALE = lerp(1, 1.22, u);
  }
}

function applyMagnus(t) {
  MAGNUS_AMOUNT = clamp(t, 0, 1);
  MAGNUS = MAGNUS_MAX * MAGNUS_AMOUNT;
}

function updateCourtBounds() {
  ROOM_W = BASE_ROOM_W * ARENA_SCALE;
  ROOM_D = BASE_ROOM_D * ARENA_SCALE;
  ROOM_H = BASE_ROOM_H * ARENA_SCALE;
  WALL_LEFT = -ROOM_W / 2;
  WALL_RIGHT = ROOM_W / 2;
  WALL_BACK = WALL_FRONT - ROOM_D;
  COURT_Z = (WALL_FRONT + WALL_BACK) / 2;
  PLAYER_SPAWN_Z = WALL_FRONT - 420;
  lx = WALL_LEFT + rad;
  rx = WALL_RIGHT - rad;
  lz = WALL_BACK + rad;
  rz = WALL_FRONT - rad;
}

function replaceGeometry(mesh, geometry) {
  if (mesh.geometry) {
    mesh.geometry.dispose();
  }
  mesh.geometry = geometry;
}

function rebuildDebugBounds() {
  if (!debugGroup) {
    return;
  }
  while (debugGroup.children.length) {
    var child = debugGroup.children[0];
    debugGroup.remove(child);
    if (child.geometry) {
      child.geometry.dispose();
    }
  }
  var box = new THREE.Box3(
    new THREE.Vector3(lx, restY, lz),
    new THREE.Vector3(rx, ROOM_H, rz)
  );
  debugGroup.add(new THREE.Box3Helper(box, 0xff5050));
  debugGroup.add(
    new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(WALL_LEFT, 0, WALL_BACK),
        new THREE.Vector3(WALL_RIGHT, 0, WALL_BACK),
        new THREE.Vector3(WALL_RIGHT, 0, WALL_FRONT),
        new THREE.Vector3(WALL_LEFT, 0, WALL_FRONT),
        new THREE.Vector3(WALL_LEFT, 0, WALL_BACK)
      ]),
      new THREE.LineBasicMaterial({ color: 0xff5050 })
    )
  );
}

function wallVisualHeight() {
  return Math.max(WALL_VIS_H, ROOM_H * 6);
}

function syncCourtMeshes() {
  if (!floorMesh) {
    return;
  }
  var wallH = wallVisualHeight();
  replaceGeometry(floorMesh, new THREE.PlaneGeometry(ROOM_W, ROOM_D));
  floorMesh.position.z = COURT_Z;
  replaceGeometry(backWall, new THREE.PlaneGeometry(ROOM_W, wallH));
  backWall.position.set(0, wallH / 2, WALL_BACK);
  replaceGeometry(leftWall, new THREE.PlaneGeometry(ROOM_D, wallH));
  leftWall.position.set(WALL_LEFT, wallH / 2, COURT_Z);
  replaceGeometry(rightWall, new THREE.PlaneGeometry(ROOM_D, wallH));
  rightWall.position.set(WALL_RIGHT, wallH / 2, COURT_Z);
  replaceGeometry(frontWall, new THREE.PlaneGeometry(ROOM_W, wallH));
  frontWall.position.set(0, wallH / 2, WALL_FRONT);

  camera.far = Math.max(28000, ROOM_D * 2.6);
  camera.updateProjectionMatrix();
  clampCameraToCourt();
  applyCameraView();

  light.position.set(-ROOM_W * 0.35, Math.max(5000, ROOM_H * 3.1), WALL_FRONT + 900);
  light.target.position.set(0, 0, COURT_Z);
  light.shadow.camera.near = 100;
  light.shadow.camera.far = Math.max(20000, ROOM_D * 2);
  light.shadow.camera.left = -ROOM_W;
  light.shadow.camera.right = ROOM_W;
  light.shadow.camera.top = 4000 * ARENA_SCALE;
  light.shadow.camera.bottom = WALL_BACK - 3000;
  light.shadow.camera.updateProjectionMatrix();
  rebuildDebugBounds();
}

function clampBallsToCourt() {
  var i;
  for (i = 0; i < balls.length; i += 1) {
    var ball = balls[i];
    ball.x = clamp(ball.x, lx, rx);
    ball.z = clamp(ball.z, lz, rz);
    if (ball.y > ROOM_H - rad * 0.2) {
      ball.y = ROOM_H - rad * 0.2;
      if (ball.vely > 0) {
        ball.vely = 0;
      }
    }
    ball.prevPose.x = ball.x;
    ball.prevPose.y = ball.y;
    ball.prevPose.z = ball.z;
    ball.view.x = ball.x;
    ball.view.y = ball.y;
    ball.view.z = ball.z;
  }
}

function applyArenaSize(percent) {
  ARENA_SCALE = clamp(percent, 50, 200) / 100;
  updateCourtBounds();
  syncCourtMeshes();
  clampBallsToCourt();
}

function capturePose(ball) {
  ball.prevPose.x = ball.x;
  ball.prevPose.y = ball.y;
  ball.prevPose.z = ball.z;
  ball.prevPose.sx = ball.sx;
  ball.prevPose.sy = ball.sy;
  ball.prevPose.sz = ball.sz;
  ball.prevPose.q.copy(ball.q);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function hypot3(x, y, z) {
  return Math.hypot(x, y, z);
}

function clampSpin(ball) {
  var w = hypot3(ball.wx, ball.wy, ball.wz);
  if (w > MAX_OMEGA && w > 0) {
    var s = MAX_OMEGA / w;
    ball.wx *= s;
    ball.wy *= s;
    ball.wz *= s;
  }
}

function integrateSpin(ball, dt) {
  var w = hypot3(ball.wx, ball.wy, ball.wz);
  if (w > 1e-8) {
    _axis.set(ball.wx / w, ball.wy / w, ball.wz / w);
    _tmpQ.setFromAxisAngle(_axis, w * dt);
    ball.q.premultiply(_tmpQ).normalize();
  }
}

function makeSkyTexture() {
  var c = document.createElement("canvas");
  c.width = 8;
  c.height = 512;
  var ctx = c.getContext("2d");
  var g = ctx.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, "#ffffff");
  g.addColorStop(1, "#0A0A0A");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 8, 512);
  var tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  return tex;
}

function makeFloorTexture() {
  var w = 512;
  var h = 2048;
  var c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  var ctx = c.getContext("2d");
  var g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, "#1a1a1a");
  g.addColorStop(1, "#2a2a2a");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "rgba(255,255,255,0.22)";
  ctx.lineJoin = "miter";
  ctx.lineCap = "butt";
  var insetX = w * 0.08;
  var insetY = h * 0.035;
  ctx.lineWidth = 6;
  ctx.strokeRect(insetX, insetY, w - insetX * 2, h - insetY * 2);
  ctx.beginPath();
  ctx.moveTo(w / 2, insetY);
  ctx.lineTo(w / 2, h - insetY);
  ctx.stroke();
  var midY = h / 2;
  ctx.beginPath();
  ctx.moveTo(insetX, midY);
  ctx.lineTo(w - insetX, midY);
  ctx.stroke();
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(w / 2, midY, w * 0.11, 0, Math.PI * 2);
  ctx.stroke();
  var tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

function makeBallTexture() {
  var c = document.createElement("canvas");
  c.width = 1024;
  c.height = 512;
  var ctx = c.getContext("2d");
  ctx.fillStyle = "#ffe100";
  ctx.fillRect(0, 0, 1024, 512);
  ctx.strokeStyle = "#1a1a1a";
  ctx.lineCap = "round";
  ctx.lineWidth = 34;
  ctx.beginPath();
  ctx.moveTo(0, 256);
  ctx.lineTo(1024, 256);
  ctx.stroke();
  ctx.lineWidth = 22;
  ctx.beginPath();
  ctx.moveTo(512, 24);
  ctx.lineTo(512, 488);
  ctx.stroke();
  ctx.lineWidth = 14;
  ctx.beginPath();
  ctx.moveTo(220, 256);
  ctx.lineTo(220, 400);
  ctx.stroke();
  var tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function spawnOffset(index) {
  var n = Math.max(BALL_COUNT, index + 1);
  var gap = rad * 4.4;
  var maxCols = Math.max(1, Math.floor((rx - lx) / gap) + 1);
  var cols = Math.min(maxCols, Math.max(1, Math.round(Math.sqrt(n))));
  var col = index % cols;
  var row = Math.floor(index / cols);
  var clusterZ = PLAYER_SPAWN_Z + (COURT_Z - PLAYER_SPAWN_Z) * 0.2;
  var frontLimit = PLAYER_SPAWN_Z - rad * 2.4;
  return {
    x: clamp((col - (cols - 1) * 0.5) * gap, lx, rx),
    y: restY,
    z: clamp(clusterZ - row * gap, lz, frontLimit)
  };
}

function placeBallAtSpawn(ball, index) {
  var pos = spawnOffset(index);
  ball.x = pos.x;
  ball.y = pos.y;
  ball.z = pos.z;
  ball.velx = 0;
  ball.vely = 0;
  ball.velz = 0;
  ball.wx = 0;
  ball.wy = 0;
  ball.wz = 0;
  ball.grounded = true;
  ball.sx = 1;
  ball.sy = 1;
  ball.sz = 1;
  ball.prevPose.x = pos.x;
  ball.prevPose.y = pos.y;
  ball.prevPose.z = pos.z;
  ball.prevPose.sx = 1;
  ball.prevPose.sy = 1;
  ball.prevPose.sz = 1;
  ball.view.x = pos.x;
  ball.view.y = pos.y;
  ball.view.z = pos.z;
  ball.view.sx = 1;
  ball.view.sy = 1;
  ball.view.sz = 1;
}

function makeBall(index) {
  var pos = spawnOffset(index);
  var squashGroup = new THREE.Group();
  var ballGroup = new THREE.Group();
  var ballMesh = new THREE.Mesh(ballGeometry, ballMaterial);
  ballMesh.castShadow = true;
  ballMesh.receiveShadow = true;
  ballGroup.add(ballMesh);
  squashGroup.add(ballGroup);
  scene.add(squashGroup);

  var shadowMesh = new THREE.Mesh(shadowGeometry, shadowMaterial.clone());
  shadowMesh.rotation.x = -Math.PI / 2;
  shadowMesh.position.y = 1.5;
  scene.add(shadowMesh);

  return {
    x: pos.x,
    y: pos.y,
    z: pos.z,
    velx: 0,
    vely: 0,
    velz: 0,
    wx: 0,
    wy: 0,
    wz: 0,
    q: new THREE.Quaternion(),
    grounded: true,
    sx: 1,
    sy: 1,
    sz: 1,
    pairPenX: 0,
    pairPenY: 0,
    pairPenZ: 0,
    prevPose: {
      x: pos.x,
      y: pos.y,
      z: pos.z,
      sx: 1,
      sy: 1,
      sz: 1,
      q: new THREE.Quaternion()
    },
    view: {
      x: pos.x,
      y: pos.y,
      z: pos.z,
      sx: 1,
      sy: 1,
      sz: 1,
      q: new THREE.Quaternion()
    },
    squashGroup: squashGroup,
    ballGroup: ballGroup,
    ballMesh: ballMesh,
    shadowMesh: shadowMesh
  };
}

function disposeBall(ball) {
  scene.remove(ball.squashGroup);
  scene.remove(ball.shadowMesh);
}

function setBallCount(count) {
  count = Math.max(1, Math.min(MAX_BALLS, count | 0));
  BALL_COUNT = count;
  while (balls.length < count) {
    balls.push(makeBall(balls.length));
  }
  while (balls.length > count) {
    disposeBall(balls.pop());
  }
  if (hoverBall && balls.indexOf(hoverBall) < 0) hoverBall = null;
  if (lastPlaneBall && balls.indexOf(lastPlaneBall) < 0) lastPlaneBall = null;
  if (grabBall && balls.indexOf(grabBall) < 0) {
    grabBall = null;
    grabbed = false;
  }
  if (chargeTarget && balls.indexOf(chargeTarget) < 0) {
    chargeTarget = null;
    strokeLocked = false;
  }
  var enableShadow = balls.length <= 16;
  var i;
  for (i = 0; i < balls.length; i += 1) {
    balls[i].ballMesh.castShadow = enableShadow;
    placeBallAtSpawn(balls[i], i);
  }
}

function pointerPlaneBall() {
  if (grabBall && balls.indexOf(grabBall) >= 0) {
    return grabBall;
  }
  if (hoverBall) {
    return hoverBall;
  }
  if (lastPlaneBall && balls.indexOf(lastPlaneBall) >= 0) {
    return lastPlaneBall;
  }
  return balls[0] || null;
}

function pointerTarget() {
  return pointerPlaneBall();
}

function isGrabbed(ball) {
  return grabbed && grabBall === ball;
}

function closestBallToRay(maxDist) {
  var picked = pickBallFromRay();
  if (picked) {
    return picked;
  }
  var origin = _ray.ray.origin;
  var dir = _ray.ray.direction;
  var best = null;
  var bestD = 1e9;
  var i;
  for (i = 0; i < balls.length; i += 1) {
    var ball = balls[i];
    var ox = ball.x - origin.x;
    var oy = ball.y - origin.y;
    var oz = ball.z - origin.z;
    var t = ox * dir.x + oy * dir.y + oz * dir.z;
    if (t < 0) {
      t = 0;
    }
    var dx = origin.x + dir.x * t - ball.x;
    var dy = origin.y + dir.y * t - ball.y;
    var dz = origin.z + dir.z * t - ball.z;
    var d = hypot3(dx, dy, dz);
    if (d < bestD) {
      bestD = d;
      best = ball;
    }
  }
  if (maxDist != null && bestD > maxDist) {
    return null;
  }
  return best;
}

function makeWallMaterial() {
  return new THREE.MeshStandardMaterial({
    color: 0x6e6e6e,
    roughness: 0.96,
    metalness: 0.02,
    side: THREE.DoubleSide
  });
}

function setupScene() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x8a8a8a);

  camera = new THREE.PerspectiveCamera(48, 1, 8, Math.max(28000, ROOM_D * 2.6));
  camera.rotation.order = "YXZ";
  camera.position.set(PLAYER_SPAWN_X, PLAYER_SPAWN_Y, PLAYER_SPAWN_Z);
  camEyeY = camera.position.y;
  camera.lookAt(PLAYER_SPAWN_X, 180, COURT_Z);
  camYaw = camera.rotation.y;
  camPitch = camera.rotation.x;
  applyCameraView();

  renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    antialias: true,
    alpha: false
  });
  renderer.setClearColor(0x0a0a0a, 1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  scene.add(new THREE.HemisphereLight(0xffffff, 0x3a3a3a, 0.7));

  light = new THREE.DirectionalLight(0xffffff, 1.15);
  light.position.set(-800, 5000, 2000);
  light.castShadow = true;
  light.shadow.mapSize.set(2048, 2048);
  light.shadow.camera.near = 100;
  light.shadow.camera.far = 20000;
  light.shadow.camera.left = -2000;
  light.shadow.camera.right = 2000;
  light.shadow.camera.top = 4000;
  light.shadow.camera.bottom = -14000;
  light.shadow.bias = -0.0002;
  scene.add(light);
  scene.add(light.target);
  light.target.position.set(0, 0, COURT_Z);

  fillLight = new THREE.DirectionalLight(0xc8c8c8, 0.28);
  fillLight.position.set(900, 400, 600);
  scene.add(fillLight);

  floorMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(ROOM_W, ROOM_D),
    new THREE.MeshStandardMaterial({
      map: makeFloorTexture(),
      roughness: 0.95,
      metalness: 0
    })
  );
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.position.z = COURT_Z;
  floorMesh.receiveShadow = true;
  scene.add(floorMesh);

  var wallMat = makeWallMaterial();
  var wallH = wallVisualHeight();
  backWall = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_W, wallH), wallMat);
  backWall.position.set(0, wallH / 2, WALL_BACK);
  backWall.receiveShadow = true;
  scene.add(backWall);

  leftWall = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_D, wallH), wallMat);
  leftWall.position.set(WALL_LEFT, wallH / 2, COURT_Z);
  leftWall.rotation.y = Math.PI / 2;
  leftWall.receiveShadow = true;
  scene.add(leftWall);

  rightWall = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_D, wallH), wallMat);
  rightWall.position.set(WALL_RIGHT, wallH / 2, COURT_Z);
  rightWall.rotation.y = -Math.PI / 2;
  rightWall.receiveShadow = true;
  scene.add(rightWall);

  frontWall = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_W, wallH), wallMat);
  frontWall.position.set(0, wallH / 2, WALL_FRONT);
  frontWall.receiveShadow = true;
  scene.add(frontWall);

  ballGeometry = new THREE.SphereGeometry(rad, 48, 32);
  ballMaterial = new THREE.MeshStandardMaterial({
    map: makeBallTexture(),
    roughness: 0.38,
    metalness: 0.04
  });
  shadowGeometry = new THREE.CircleGeometry(rad, 48);
  shadowMaterial = new THREE.MeshBasicMaterial({
    color: 0x141414,
    transparent: true,
    opacity: 0.55,
    depthWrite: false
  });
  setBallCount(BALL_COUNT);

  puckMesh = new THREE.Mesh(
    new THREE.RingGeometry(18, 28, 24),
    new THREE.MeshBasicMaterial({
      color: 0x111111,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide,
      depthTest: false
    })
  );
  puckMesh.renderOrder = 2;
  scene.add(puckMesh);

  chargeMarker = new THREE.Mesh(
    new THREE.SphereGeometry(22, 16, 12),
    new THREE.MeshBasicMaterial({
      color: 0x111111,
      transparent: true,
      opacity: 0.85,
      depthTest: false
    })
  );
  chargeMarker.visible = false;
  chargeMarker.renderOrder = 3;
  scene.add(chargeMarker);

  var strokePositions = new Float32Array(6);
  var strokeGeom = new THREE.BufferGeometry();
  strokeGeom.setAttribute("position", new THREE.BufferAttribute(strokePositions, 3));
  strokeLine = new THREE.Line(
    strokeGeom,
    new THREE.LineBasicMaterial({
      color: 0xffc14a,
      depthTest: false,
      transparent: true,
      opacity: 0.95
    })
  );
  strokeLine.frustumCulled = false;
  strokeLine.renderOrder = 4;
  strokeLine.visible = false;
  scene.add(strokeLine);

  strokeMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(1, 1, 1, 8, 1, false),
    new THREE.MeshBasicMaterial({
      color: 0xffc14a,
      depthTest: false,
      transparent: true,
      opacity: 0.92
    })
  );
  strokeMesh.frustumCulled = false;
  strokeMesh.renderOrder = 5;
  strokeMesh.visible = false;
  scene.add(strokeMesh);

  debugGroup = new THREE.Group();
  debugGroup.visible = SHOW_DEBUG;
  scene.add(debugGroup);
  rebuildDebugBounds();
}

function resizeRenderer() {
  var cssW = window.innerWidth;
  var cssH = window.innerHeight;
  var dpr = window.devicePixelRatio || 1;
  if (dpr > 1.25) {
    dpr = 1.25;
  }
  var maxPixels = 2560 * 1440;
  if (cssW * cssH * dpr * dpr > maxPixels) {
    dpr = Math.sqrt(maxPixels / Math.max(cssW * cssH, 1));
  }
  renderer.setPixelRatio(dpr);
  renderer.setSize(cssW, cssH, false);
  camera.aspect = cssW / Math.max(cssH, 1);
  camera.updateProjectionMatrix();
}

function applyCameraView() {
  if (!camera) {
    return;
  }
  camera.rotation.order = "YXZ";
  camera.position.y = camEyeY;
  camera.rotation.y = camYaw;
  camera.rotation.x = camPitch;
  camera.rotation.z = 0;
  camera.updateMatrixWorld();
}

function clampCameraToCourt() {
  if (!camera) {
    return;
  }
  var pad = 90;
  camera.position.x = clamp(camera.position.x, WALL_LEFT + pad, WALL_RIGHT - pad);
  camera.position.z = clamp(camera.position.z, WALL_BACK + pad, WALL_FRONT - pad);
  camEyeY = clamp(camEyeY, CAM_WALK_Y, Math.max(CAM_WALK_Y, ROOM_H - 80));
  camera.position.y = camEyeY;
}

function isCamKeyTarget(event) {
  var el = event.target;
  var tag = el && el.tagName;
  var form = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || tag === "BUTTON";
  if (!form) {
    return true;
  }
  if (event.code.indexOf("Arrow") === 0) {
    return false;
  }
  return isCamKey(event.code);
}

function isCamKey(code) {
  return (
    code === "KeyW" ||
    code === "KeyA" ||
    code === "KeyS" ||
    code === "KeyD" ||
    code === "KeyQ" ||
    code === "KeyE" ||
    code === "KeyR" ||
    code === "KeyF" ||
    code === "Space" ||
    code === "ShiftLeft" ||
    code === "ShiftRight" ||
    code === "ArrowLeft" ||
    code === "ArrowRight" ||
    code === "ArrowUp" ||
    code === "ArrowDown"
  );
}

function refreshPointerFromCamera() {
  if (!hasPointerClient) {
    return;
  }
  setPointerFromEvent(lastPointerClientX, lastPointerClientY);
}

function lookByBackgroundDrag(dx, dy) {
  if (!dx && !dy) {
    return;
  }
  camYaw += dx * CAM_DRAG_SENS;
  camPitch = clamp(camPitch + dy * CAM_DRAG_SENS, CAM_PITCH_MIN, CAM_PITCH_MAX);
  applyCameraView();
  refreshPointerFromCamera();
}

function updateWalkCamera(dt) {
  if (!camera) {
    return;
  }
  var turning = 0;
  if (keys.ArrowLeft) {
    turning += 1;
  }
  if (keys.ArrowRight) {
    turning -= 1;
  }
  var pitching = 0;
  if (keys.ArrowUp) {
    pitching += 1;
  }
  if (keys.ArrowDown) {
    pitching -= 1;
  }
  camYaw += turning * CAM_TURN * dt;
  camPitch = clamp(camPitch + pitching * CAM_TURN * 0.72 * dt, CAM_PITCH_MIN, CAM_PITCH_MAX);

  if (camGrounded && keys.Space) {
    camVelY = CAM_JUMP_VEL;
    camGrounded = false;
  }
  if (!camGrounded) {
    camVelY -= CAM_GRAVITY * dt;
    camEyeY += camVelY * dt;
    if (camEyeY <= CAM_WALK_Y) {
      camEyeY = CAM_WALK_Y;
      camVelY = 0;
      camGrounded = true;
    }
  } else {
    camEyeY = CAM_WALK_Y;
    camVelY = 0;
  }

  var wishX = 0;
  var wishZ = 0;
  if (keys.KeyW) {
    wishZ += 1;
  }
  if (keys.KeyS) {
    wishZ -= 1;
  }
  if (keys.KeyA) {
    wishX -= 1;
  }
  if (keys.KeyD) {
    wishX += 1;
  }
  if (wishX !== 0 || wishZ !== 0) {
    var len = Math.hypot(wishX, wishZ) || 1;
    wishX /= len;
    wishZ /= len;
    _camFwdFlat.set(-Math.sin(camYaw), 0, -Math.cos(camYaw));
    _camRightFlat.set(-_camFwdFlat.z, 0, _camFwdFlat.x);
    var sprint = keys.ShiftLeft || keys.ShiftRight ? CAM_SPRINT : 1;
    var step = CAM_SPEED * sprint * dt;
    camera.position.x += (_camRightFlat.x * wishX + _camFwdFlat.x * wishZ) * step;
    camera.position.z += (_camRightFlat.z * wishX + _camFwdFlat.z * wishZ) * step;
  }
  clampCameraToCourt();
  applyCameraView();
  if (wishX !== 0 || wishZ !== 0 || turning !== 0 || pitching !== 0 || !camGrounded) {
    refreshPointerFromCamera();
  }
}

function updatePointerRay(clientX, clientY) {
  lastPointerClientX = clientX;
  lastPointerClientY = clientY;
  hasPointerClient = true;
  var rect = canvas.getBoundingClientRect();
  _ndc.x = ((clientX - rect.left) / Math.max(rect.width, 1)) * 2 - 1;
  _ndc.y = -((clientY - rect.top) / Math.max(rect.height, 1)) * 2 + 1;
  _ray.setFromCamera(_ndc, camera);
}

function projectPointerOnBall(ball) {
  if (!ball) {
    return false;
  }
  camera.getWorldDirection(_look);
  _hitPlane.setFromNormalAndCoplanarPoint(
    _look,
    _tmpA.set(ball.x, ball.y, ball.z)
  );
  if (!_ray.ray.intersectPlane(_hitPlane, _hitPoint)) {
    return false;
  }
  ptr.copy(_hitPoint);
  return true;
}

function setPointerFromEvent(clientX, clientY) {
  updatePointerRay(clientX, clientY);
  updateHover();
  var target = pointerPlaneBall();
  lastPlaneBall = target;
  return projectPointerOnBall(target);
}

function rayBallIntersect(ball, outPoint) {
  var invX = 1 / (rad * ball.sx);
  var invY = 1 / (rad * ball.sy);
  var invZ = 1 / (rad * ball.sz);
  var ox = (_ray.ray.origin.x - ball.x) * invX;
  var oy = (_ray.ray.origin.y - ball.y) * invY;
  var oz = (_ray.ray.origin.z - ball.z) * invZ;
  var dx = _ray.ray.direction.x * invX;
  var dy = _ray.ray.direction.y * invY;
  var dz = _ray.ray.direction.z * invZ;
  var a = dx * dx + dy * dy + dz * dz;
  var b = 2 * (ox * dx + oy * dy + oz * dz);
  var c = ox * ox + oy * oy + oz * oz - 1;
  var disc = b * b - 4 * a * c;
  if (disc < 0 || a <= 0) {
    return -1;
  }
  var t = (-b - Math.sqrt(disc)) / (2 * a);
  if (t <= 0) {
    t = (-b + Math.sqrt(disc)) / (2 * a);
  }
  if (t <= 0) {
    return -1;
  }
  if (outPoint) {
    outPoint.copy(_ray.ray.origin).addScaledVector(_ray.ray.direction, t);
  }
  return t;
}

function pickBallFromRay(outPoint) {
  var best = null;
  var bestT = 1e9;
  var i;
  for (i = 0; i < balls.length; i += 1) {
    var t = rayBallIntersect(balls[i], _tmpA);
    if (t >= 0 && t < bestT) {
      bestT = t;
      best = balls[i];
      if (outPoint) {
        outPoint.copy(_tmpA);
      }
    }
  }
  return best;
}

function strokeAnchor() {
  return hoverBall || lastPlaneBall || balls[0];
}

function strokeNdcLen() {
  return Math.hypot(_ndc.x - strokeStartNdc.x, _ndc.y - strokeStartNdc.y);
}

function updateStrokeEnds() {
  var ball = strokeAnchor();
  if (!ball) {
    return false;
  }
  if (!projectNdcOnPoint(strokeStartNdc.x, strokeStartNdc.y, ball.x, ball.y, ball.z, _strokeFrom)) {
    return false;
  }
  if (pickBallFromRay(_chargeHit)) {
    _strokeTo.copy(_chargeHit);
  } else if (!projectNdcOnPoint(_ndc.x, _ndc.y, ball.x, ball.y, ball.z, _strokeTo)) {
    return false;
  }
  camera.getWorldDirection(_look);
  _strokeFrom.addScaledVector(_look, -22);
  _strokeTo.addScaledVector(_look, -14);
  return hypot3(
    _strokeTo.x - _strokeFrom.x,
    _strokeTo.y - _strokeFrom.y,
    _strokeTo.z - _strokeFrom.z
  ) > 6;
}

function hideStrokeLine() {
  if (strokeLine) {
    strokeLine.visible = false;
  }
  if (strokeMesh) {
    strokeMesh.visible = false;
  }
}

function placeStrokeLine(color, alpha) {
  if (!updateStrokeEnds()) {
    hideStrokeLine();
    return;
  }
  _strokeDir.set(
    _strokeTo.x - _strokeFrom.x,
    _strokeTo.y - _strokeFrom.y,
    _strokeTo.z - _strokeFrom.z
  );
  var len = _strokeDir.length();
  var pos = strokeLine.geometry.attributes.position;
  pos.setXYZ(0, _strokeFrom.x, _strokeFrom.y, _strokeFrom.z);
  pos.setXYZ(1, _strokeTo.x, _strokeTo.y, _strokeTo.z);
  pos.needsUpdate = true;
  strokeLine.geometry.computeBoundingSphere();
  strokeLine.visible = true;
  strokeLine.material.color.copy(color);
  strokeLine.material.opacity = alpha;

  _strokeDir.multiplyScalar(1 / len);
  strokeMesh.position.set(
    (_strokeFrom.x + _strokeTo.x) * 0.5,
    (_strokeFrom.y + _strokeTo.y) * 0.5,
    (_strokeFrom.z + _strokeTo.z) * 0.5
  );
  if (_strokeDir.y > 0.999) {
    strokeMesh.quaternion.identity();
  } else if (_strokeDir.y < -0.999) {
    strokeMesh.quaternion.setFromAxisAngle(_axis.set(1, 0, 0), Math.PI);
  } else {
    strokeMesh.quaternion.setFromUnitVectors(_worldUp, _strokeDir);
  }
  var dist = camera.position.distanceTo(strokeMesh.position);
  var thick = Math.max(7, dist * 0.0032);
  strokeMesh.scale.set(thick, len, thick);
  strokeMesh.visible = true;
  strokeMesh.material.color.copy(color);
  strokeMesh.material.opacity = alpha;
}

function strokeRangeBoost(ball) {
  ball = ball || strokeAnchor();
  if (!ball || !camera) {
    return 1;
  }
  var dist = hypot3(
    ball.x - camera.position.x,
    ball.y - camera.position.y,
    ball.z - camera.position.z
  );
  return clamp(1 + (dist / STROKE_NEAR_DIST - 1) * STROKE_FAR_COMP, 1, STROKE_FAR_MAX);
}

function strokeLength() {
  if (!charging) {
    return 0;
  }
  return strokeNdcLen() / STROKE_NDC_FULL * STROKE_FULL * strokeRangeBoost();
}

function strokeStrength(len) {
  var reach = Math.max(0, len - STROKE_MIN);
  var span = Math.max(STROKE_FULL - STROKE_MIN, 1);
  var u = Math.log1p(reach / STROKE_LOG) / Math.log1p(span / STROKE_LOG);
  u = clamp(u, 0, 1);
  return Math.pow(u, STROKE_EASE);
}

function strokePower() {
  if (!charging) {
    return 0;
  }
  return strokeStrength(strokeLength());
}

function anyButtonDown() {
  return leftDown || rightDown;
}

function updateHover() {
  hoverBall = pickBallFromRay(_ballHit);
  overBall = hoverBall != null;
  if (charging || grabbed) {
    canvas.style.cursor = "grabbing";
  } else if (overBall) {
    canvas.style.cursor = "pointer";
  } else {
    canvas.style.cursor = "default";
  }
}

function wakeBall(ball) {
  if (ball) {
    ball.grounded = false;
  }
}

function topBounceSpeed() {
  var travel = Math.max(ROOM_H - restY - 36, 480);
  return Math.sqrt(2 * GRAVITY * travel) * 1.08;
}

function maxImpactSpeed() {
  return (topBounceSpeed() / BOUNCE_E) * HIT_POWER;
}

function mapHitSpeed(speed) {
  if (speed < HIT_NOISE) {
    return 0;
  }
  return Math.min(speed, MAX_SLAM_CURSOR) * (maxImpactSpeed() / MAX_SLAM_CURSOR);
}

function applyHitSpin(ball, vx, vy, vz, px, py, pz, spin) {
  if (!ball) {
    return;
  }
  if (px == null) {
    px = ptr.x;
    py = ptr.y;
    pz = ptr.z;
  }
  if (spin == null) {
    spin = HIT_SPIN;
  }
  var rx = px - ball.x;
  var ry = py - ball.y;
  var rz = pz - ball.z;
  if (rx * rx + ry * ry + rz * rz < 80) {
    return;
  }
  var jx = vx - ball.velx;
  var jy = vy - ball.vely;
  var jz = vz - ball.velz;
  ball.wx += (ry * jz - rz * jy) * spin / BALL_I;
  ball.wy += (rz * jx - rx * jz) * spin / BALL_I;
  ball.wz += (rx * jy - ry * jx) * spin / BALL_I;
  clampSpin(ball);
}

function hitBall(ball, vx, vy, vz, px, py, pz, spin) {
  if (!ball) {
    return;
  }
  applyHitSpin(ball, vx, vy, vz, px, py, pz, spin);
  wakeBall(ball);
  vx *= HIT_SCALE;
  vy *= HIT_SCALE;
  vz *= HIT_SCALE;
  var speed = hypot3(vx, vy, vz);
  if (speed > MAX_SPEED && speed > 0) {
    var s = MAX_SPEED / speed;
    vx *= s;
    vy *= s;
    vz *= s;
  }
  ball.velx = vx;
  ball.vely = vy;
  ball.velz = vz;
}

function notePtrPos(now) {
  ptrPath.push({ t: now, nx: _ndc.x, ny: _ndc.y });
  var cutoff = now - 220;
  while (ptrPath.length > 2 && ptrPath[0].t < cutoff) {
    ptrPath.shift();
  }
}

function projectNdcOnPoint(nx, ny, px, py, pz, out) {
  _ndcSample.set(nx, ny);
  _swingRay.setFromCamera(_ndcSample, camera);
  camera.getWorldDirection(_look);
  _swingPlane.setFromNormalAndCoplanarPoint(_look, _tmpA.set(px, py, pz));
  return _swingRay.ray.intersectPlane(_swingPlane, out) != null;
}

function ptrPathSample(lookback) {
  if (lookback == null) {
    lookback = HIT_LOOKBACK;
  }
  if (ptrPath.length < 2) {
    return null;
  }
  var newest = ptrPath[ptrPath.length - 1];
  var sample = ptrPath[0];
  var i;
  for (i = 0; i < ptrPath.length - 1; i += 1) {
    if (newest.t - ptrPath[i].t >= lookback) {
      sample = ptrPath[i];
    }
  }
  var dt = (newest.t - sample.t) / 1000;
  if (dt < 0.016) {
    return null;
  }
  return { newest: newest, sample: sample, dt: dt };
}

function swingVelocity(ball, lookback) {
  ball = ball || hoverBall || lastPlaneBall || balls[0];
  var path = ptrPathSample(lookback);
  if (!ball || !path) {
    return { vx: 0, vy: 0, vz: 0, speed: 0 };
  }
  if (!projectNdcOnPoint(path.newest.nx, path.newest.ny, ball.x, ball.y, ball.z, _swingTo)) {
    return { vx: 0, vy: 0, vz: 0, speed: 0 };
  }
  if (!projectNdcOnPoint(path.sample.nx, path.sample.ny, ball.x, ball.y, ball.z, _swingFrom)) {
    return { vx: 0, vy: 0, vz: 0, speed: 0 };
  }
  var vx = (_swingTo.x - _swingFrom.x) / path.dt;
  var vy = (_swingTo.y - _swingFrom.y) / path.dt;
  var vz = (_swingTo.z - _swingFrom.z) / path.dt;
  if (!isFinite(vx) || !isFinite(vy) || !isFinite(vz)) {
    return { vx: 0, vy: 0, vz: 0, speed: 0 };
  }
  return { vx: vx, vy: vy, vz: vz, speed: hypot3(vx, vy, vz) };
}

function ndcSwing(lookback) {
  var path = ptrPathSample(lookback);
  if (!path) {
    return { nx: 0, ny: 0, speed: 0 };
  }
  var nx = (path.newest.nx - path.sample.nx) / path.dt;
  var ny = (path.newest.ny - path.sample.ny) / path.dt;
  if (!isFinite(nx) || !isFinite(ny)) {
    return { nx: 0, ny: 0, speed: 0 };
  }
  return { nx: nx, ny: ny, speed: Math.hypot(nx, ny) };
}

function tryBatHit() {
  if (anyButtonDown() || grabbed || charging || !hoverBall) {
    return;
  }
  var swing = ndcSwing();
  if (swing.speed < BAT_NOISE_NDC) {
    return;
  }
  var t = Math.min(swing.speed / BAT_MAX_NDC, 1);
  var mapped = maxImpactSpeed() * BAT_SENSITIVITY * t;
  if (mapped < 70) {
    return;
  }
  cameraBasis();
  var dx = _camRight.x * swing.nx + _camUp.x * swing.ny;
  var dy = _camRight.y * swing.nx + _camUp.y * swing.ny;
  var dz = _camRight.z * swing.nx + _camUp.z * swing.ny;
  var dirLen = hypot3(dx, dy, dz) || 1;
  dx /= dirLen;
  dy /= dirLen;
  dz /= dirLen;
  var ballAlong = hoverBall.velx * dx + hoverBall.vely * dy + hoverBall.velz * dz;
  if (mapped <= Math.max(ballAlong, 0) + 50) {
    return;
  }
  hitBall(
    hoverBall,
    dx * mapped,
    dy * mapped,
    dz * mapped,
    _ballHit.x,
    _ballHit.y,
    _ballHit.z,
    BAT_SPIN
  );
}

function captureContact(target) {
  if (!target) {
    return;
  }
  if (rayBallIntersect(target, _ballHit) >= 0) {
    chargeOffset.set(_ballHit.x - target.x, _ballHit.y - target.y, _ballHit.z - target.z);
    return;
  }
  var ox = ptr.x - target.x;
  var oy = ptr.y - target.y;
  var oz = ptr.z - target.z;
  var len = hypot3(ox, oy, oz);
  if (len < 1) {
    camera.getWorldDirection(_look);
    chargeOffset.set(-_look.x * rad, -_look.y * rad, -_look.z * rad);
    return;
  }
  var scale = rad / len;
  chargeOffset.set(ox * scale, oy * scale, oz * scale);
}

function cancelStroke() {
  charging = false;
  chargeFired = false;
  chargeTarget = null;
  strokeLocked = false;
  hideStrokeLine();
}

function startStroke() {
  charging = true;
  chargeFired = false;
  strokeLocked = false;
  chargeTarget = null;
  strokeStartNdc.copy(_ndc);
  strokeStart.copy(ptr);
  canvas.style.cursor = "grabbing";
}

function cameraBasis() {
  camera.getWorldDirection(_look);
  _camRight.crossVectors(_look, _worldUp);
  if (_camRight.lengthSq() < 1e-8) {
    _camRight.set(1, 0, 0);
  } else {
    _camRight.normalize();
  }
  _camUp.crossVectors(_camRight, _look).normalize();
  _courtFwd.set(_look.x, 0, _look.z);
  if (_courtFwd.lengthSq() < 1e-8) {
    _courtFwd.set(0, 0, -1);
  } else {
    _courtFwd.normalize();
  }
}

function camPlaneOffset(point, ball, axis) {
  return (
    ((point.x - ball.x) * axis.x +
      (point.y - ball.y) * axis.y +
      (point.z - ball.z) * axis.z) /
    rad
  );
}

// Positive = +wy = curve left. Negative = curve right.
function wrapSideSpin(hitR, startR, wR, swing) {
  hitR = clamp(hitR, -1.2, 1.2);
  var onLeft = hitR < -0.04;
  var onRight = hitR > 0.04;
  var mag = clamp(
    Math.max(Math.abs(hitR) * 1.15, Math.min(Math.abs(startR), 1.15) * 0.55, 0.38) +
      Math.abs(wR) * 0.32,
    0.38,
    2.2
  );
  // A click or short poke uses the hit point only: right face → left spin.
  if (swing == null || swing < 0.18) {
    if (onRight) {
      return mag;
    }
    if (onLeft) {
      return -mag;
    }
    return clamp(hitR * 0.9, -1.85, 1.85);
  }
  var startOutside = Math.abs(startR) > 1.05;
  var goingRight = wR > 0.14 || hitR > startR + 0.12;
  var goingLeft = wR < -0.14 || hitR < startR - 0.12;
  var fromLeft = startR < -0.08;
  var fromRight = startR > 0.08;
  // Cross the face: left → right curves left, right → left curves right.
  if (fromLeft && onRight) {
    return mag;
  }
  if (fromRight && onLeft) {
    return -mag;
  }
  if (!startOutside && fromLeft && goingRight && hitR < 0) {
    return mag;
  }
  if (!startOutside && fromRight && goingLeft && hitR > 0) {
    return -mag;
  }
  // Same-side wrap, including coming from outside onto that side.
  if (onLeft || (fromLeft && !goingRight)) {
    return -mag;
  }
  if (onRight || (fromRight && !goingLeft)) {
    return mag;
  }
  return clamp(wR * 0.9 + hitR * 0.55, -1.85, 1.85);
}

// Positive = backspin. Negative = topspin.
function wrapBackSpin(hitU, startU, wU, swing) {
  hitU = clamp(hitU, -1.2, 1.2);
  var mag = clamp(
    Math.max(
      Math.abs(hitU) * 1.05,
      Math.min(Math.abs(startU), 1.25) * 0.45,
      Math.abs(wU) * 0.9,
      0.55
    ) + (swing > 0.18 ? swing * 0.4 : 0),
    0.55,
    2.05
  );
  if (swing == null || swing < 0.18) {
    return clamp(-hitU * 1.1, -1.85, 1.85);
  }
  var goingUp = wU > 0.1 || hitU > startU + 0.1;
  var goingDown = wU < -0.1 || hitU < startU - 0.1;
  if (goingUp && !goingDown) {
    return -mag;
  }
  if (goingDown) {
    return mag;
  }
  return clamp(-hitU * 0.95, -1.7, 1.7);
}

function applyWrapSpin(ball, hitR, hitU, startR, startU, wR, wU, t, edge, swing) {
  hitR = clamp(hitR, -1.15, 1.15);
  hitU = clamp(hitU, -1.15, 1.15);
  if (edge == null) {
    edge = clamp(Math.hypot(hitR, hitU), 0, 1);
  }
  // Right face → left spin. Left face → right spin.
  // Low→high brush → topspin. High→low → backspin.
  var side = wrapSideSpin(hitR, startR, wR, swing);
  var back = wrapBackSpin(hitU, startU, wU, swing);
  var sideEdge = clamp(Math.abs(hitR), 0, 1);
  var vertEdge = clamp(Math.max(Math.abs(hitU), Math.abs(wU), swing * 0.75), 0, 1);
  var mag =
    MAX_OMEGA *
    WRAP_SPIN *
    lerp(0.5, 1.12, edge) *
    clamp(0.58 + t * 0.5, 0.58, 1.22);
  var sideMag = mag * WRAP_SIDE_SPIN * lerp(0.72, 1.38, sideEdge);
  var vertMag = mag * lerp(0.95, 1.42, vertEdge);
  ball.wx = _camRight.x * back * vertMag;
  ball.wy = side * sideMag + _camRight.y * back * vertMag;
  ball.wz = _camRight.z * back * vertMag;
  clampSpin(ball);
}

function fireStrokeHit() {
  var target = hoverBall || closestBallToRay(rad * 1.8);
  if (!target) {
    cancelStroke();
    chargeFired = true;
    return;
  }
  captureContact(target);
  cameraBasis();
  var ndx = _ndc.x - strokeStartNdc.x;
  var ndy = _ndc.y - strokeStartNdc.y;
  var nlen = Math.hypot(ndx, ndy);
  if (nlen < STROKE_NDC_DEAD) {
    ndx = 0;
    ndy = 0;
  }
  var t = strokeStrength(nlen / STROKE_NDC_FULL * STROKE_FULL * strokeRangeBoost(target));
  var hitR = (chargeOffset.x * _camRight.x + chargeOffset.y * _camRight.y + chargeOffset.z * _camRight.z) / rad;
  var hitU = (chargeOffset.x * _camUp.x + chargeOffset.y * _camUp.y + chargeOffset.z * _camUp.z) / rad;
  var startR = 0;
  var startU = 0;
  if (projectNdcOnPoint(strokeStartNdc.x, strokeStartNdc.y, target.x, target.y, target.z, _strokeFrom)) {
    startR = camPlaneOffset(_strokeFrom, target, _camRight);
    startU = camPlaneOffset(_strokeFrom, target, _camUp);
  }
  var edge = clamp(Math.hypot(hitR, hitU), 0, 1);
  var speed =
    lerp(maxImpactSpeed() * 0.14, maxImpactSpeed() * 0.24, t) *
    lerp(1, STROKE_EDGE_POWER, edge);
  var wrapLen = Math.max(nlen, 1e-4);
  var wR = ndx / wrapLen;
  var wU = ndy / wrapLen;
  var swing = Math.min(nlen / 0.42, 1);
  var sideAim = wR * STROKE_AIM * swing * 0.22;
  // Side clicks stay forward. Only a true outside-in wrap steers off-axis.
  if (startR < -1.05 && hitR < -0.04) {
    sideAim += CONTACT_AIM * clamp(-hitR, 0.15, 1) + 0.18;
  } else if (startR > 1.05 && hitR > 0.04) {
    sideAim -= CONTACT_AIM * clamp(hitR, 0.15, 1) + 0.18;
  }
  var vertAim = wU * STROKE_LIFT * swing - hitU * 0.14;
  vertAim = clamp(vertAim, -0.34, 0.36);
  var dx = _courtFwd.x + _camRight.x * sideAim;
  var dy = vertAim;
  var dz = _courtFwd.z + _camRight.z * sideAim;
  var along = dx * _courtFwd.x + dz * _courtFwd.z;
  if (along < STROKE_MIN_FORWARD) {
    var add = STROKE_MIN_FORWARD - along;
    dx += _courtFwd.x * add;
    dz += _courtFwd.z * add;
  }
  var dirLen = hypot3(dx, dy, dz) || 1;
  dx /= dirLen;
  dy /= dirLen;
  dz /= dirLen;
  var hx = target.x + chargeOffset.x;
  var hy = target.y + chargeOffset.y;
  var hz = target.z + chargeOffset.z;
  hitBall(target, dx * speed, dy * speed, dz * speed, hx, hy, hz, 0);
  applyWrapSpin(target, hitR, hitU, startR, startU, wR, wU, t, edge, swing);
  cancelStroke();
  chargeFired = true;
}

function trackPointer(clientX, clientY) {
  if (!ptrInitialized) {
    if (!setPointerFromEvent(clientX, clientY)) {
      return;
    }
    prevPtr.copy(ptr);
    ptrInitialized = true;
    notePtrPos(performance.now());
    ptrInside = overBall;
    return;
  }
  var prevHover = hoverBall;
  prevPtr.copy(ptr);
  if (!setPointerFromEvent(clientX, clientY)) {
    return;
  }
  var switchedBall = prevHover != null && hoverBall != null && prevHover !== hoverBall;
  if (switchedBall) {
    prevPtr.copy(ptr);
  }
  notePtrPos(performance.now());

  if (
    anyButtonDown() &&
    (Math.abs(ptr.x - prevPtr.x) > 6 ||
      Math.abs(ptr.y - prevPtr.y) > 6 ||
      Math.abs(ptr.z - prevPtr.z) > 6)
  ) {
    grabMoved = true;
  }
  if (grabbed && grabBall && !charging && !switchedBall) {
    var grx = ptr.x - grabBall.x;
    var gry = ptr.y - grabBall.y;
    var grz = ptr.z - grabBall.z;
    var dpx = ptr.x - prevPtr.x;
    var dpy = ptr.y - prevPtr.y;
    var dpz = ptr.z - prevPtr.z;
    grabBall.wx += (gry * dpz - grz * dpy) * 2.2 / BALL_I;
    grabBall.wy += (grz * dpx - grx * dpz) * 2.2 / BALL_I;
    grabBall.wz += (grx * dpy - gry * dpx) * 2.2 / BALL_I;
    clampSpin(grabBall);
  }

  if (rightDown && charging) {
    chargeTarget = hoverBall;
  }
  tryBatHit();
  ptrInside = overBall;
}

function onPointerDown(event) {
  if (event.pointerType === "mouse" && event.button !== 0 && event.button !== 2) {
    return;
  }
  if (document.activeElement && document.activeElement.blur) {
    document.activeElement.blur();
  }
  updatePointerRay(event.clientX, event.clientY);
  updateHover();
  ptrInitialized = true;
  if (event.button !== 2) {
    ptrPath.length = 0;
  }
  notePtrPos(performance.now());
  grabMoved = false;
  grabStartedAt = performance.now();
  canvas.setPointerCapture(event.pointerId);
  event.preventDefault();
  if (event.button === 2) {
    grabbed = false;
    grabBall = null;
    looking = false;
    rightDown = true;
    startStroke();
  } else if (!rightDown) {
    leftDown = true;
    if (hoverBall) {
      grabBall = hoverBall;
      grabbed = true;
      wakeBall(grabBall);
      looking = false;
    } else {
      looking = true;
      canvas.style.cursor = "grabbing";
    }
  }
  ptrInside = overBall;
}

function onPointerMove(event) {
  lastPointerMoveAt = event.timeStamp;
  if (looking && leftDown) {
    lookByBackgroundDrag(event.movementX, event.movementY);
  }
  trackPointer(event.clientX, event.clientY);
  if (grabbed || charging || leftDown || looking) {
    event.preventDefault();
  }
}

function releaseBall() {
  if (!grabbed) {
    return;
  }
  grabbed = false;
  if (grabBall) {
    wakeBall(grabBall);
  }
  grabBall = null;
}

function onPointerUp(event) {
  if (event.button === 0) {
    leftDown = false;
  }
  if (event.button === 2) {
    rightDown = false;
  }
  setPointerFromEvent(event.clientX, event.clientY);
  updateHover();
  if (event.button !== 2) {
    if (!rightDown) {
      updateHover();
    }
    if (event.cancelable) {
      event.preventDefault();
    }
    if (event.button === 0) {
      looking = false;
      releaseBall();
      updateHover();
    }
    return;
  }
  if (chargeFired) {
    charging = false;
    updateHover();
    if (event.cancelable) {
      event.preventDefault();
    }
    return;
  }
  if (charging) {
    var shotTarget = hoverBall || closestBallToRay(rad * 1.8);
    if (shotTarget) {
      fireStrokeHit();
    } else {
      cancelStroke();
    }
    updateHover();
    if (event.cancelable) {
      event.preventDefault();
    }
  }
}

function onPointerCancel() {
  leftDown = false;
  rightDown = false;
  looking = false;
  cancelStroke();
  grabbed = false;
  grabBall = null;
}

function onWheel(event) {
  setPointerFromEvent(event.clientX, event.clientY);
  if (!overBall) {
    return;
  }
  event.preventDefault();
  var scale = event.deltaY / 100;
  if (Math.abs(scale) < 0.2) {
    scale = event.deltaY > 0 ? 1 : -1;
  }
  scale = clamp(scale, -3, 3);
  var impulse = ROLL_IMPULSE * scale;
  cameraBasis();
  var fx = _courtFwd.x;
  var fz = _courtFwd.z;
  _camRightFlat.set(-fz, 0, fx);
  hoverBall.velx += -fx * impulse;
  hoverBall.velz += -fz * impulse;
  hoverBall.wx -= _camRightFlat.x * impulse / rad;
  hoverBall.wz -= _camRightFlat.z * impulse / rad;
  wakeBall(hoverBall);
  clampSpin(hoverBall);
}

function handlers() {
  canvas.style.touchAction = "none";
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerCancel);
  canvas.addEventListener("contextmenu", function (event) {
    event.preventDefault();
  });
  canvas.addEventListener("wheel", onWheel, { passive: false });
  window.addEventListener("keydown", function (event) {
    if (!isCamKeyTarget(event) || !isCamKey(event.code)) {
      return;
    }
    keys[event.code] = true;
    if (event.code === "Space" || event.code.indexOf("Arrow") === 0) {
      event.preventDefault();
    }
  });
  window.addEventListener("keyup", function (event) {
    keys[event.code] = false;
  });
  window.addEventListener("blur", function () {
    leftDown = false;
    rightDown = false;
    looking = false;
    cancelStroke();
    grabbed = false;
    grabBall = null;
    keys = Object.create(null);
  });
}

function contactAccel(pen, vel, k, c) {
  return -k * pen - c * vel;
}

function addSpringContact(ball, nx, ny, nz, pen, accel) {
  if (pen <= 0) {
    return;
  }
  var vIn = -(ball.velx * nx + ball.vely * ny + ball.velz * nz);
  var push = -contactAccel(pen, vIn, SQUASH_K, SQUASH_C);
  accel.x += nx * push;
  accel.y += ny * push;
  accel.z += nz * push;
  if (isGrabbed(ball)) {
    return;
  }
  var rx = -nx * rad;
  var ry = -ny * rad;
  var rz = -nz * rad;
  var cx = ball.velx + (ball.wy * rz - ball.wz * ry);
  var cy = ball.vely + (ball.wz * rx - ball.wx * rz);
  var cz = ball.velz + (ball.wx * ry - ball.wy * rx);
  var cn = cx * nx + cy * ny + cz * nz;
  var slipX = cx - cn * nx;
  var slipY = cy - cn * ny;
  var slipZ = cz - cn * nz;
  var gx = -SPIN_FRICTION * slipX;
  var gy = -SPIN_FRICTION * slipY;
  var gz = -SPIN_FRICTION * slipZ;
  accel.x += gx;
  accel.y += gy;
  accel.z += gz;
  accel.ax += (ry * gz - rz * gy) / BALL_I;
  accel.ay += (rz * gx - rx * gz) / BALL_I;
  accel.az += (rx * gy - ry * gx) / BALL_I;
}

function resolveMaxPen(ball, nx, ny, nz, rest) {
  var ndp = ball.x * nx + ball.y * ny + ball.z * nz;
  var pen = rest - ndp;
  if (pen > MAX_PEN) {
    var extra = pen - MAX_PEN;
    ball.x += nx * extra;
    ball.y += ny * extra;
    ball.z += nz * extra;
    var vn = ball.velx * nx + ball.vely * ny + ball.velz * nz;
    if (vn < 0) {
      var bounce = vn * (1 + BOUNCE_E);
      ball.velx -= nx * bounce;
      ball.vely -= ny * bounce;
      ball.velz -= nz * bounce;
    }
  }
}

function integrate(ball, dt) {
  var grabbedBall = isGrabbed(ball);
  if (ball.grounded && !grabbedBall) {
    ball.y = restY;
    ball.vely = 0;
    var crx = 0;
    var cry = -rad;
    var crz = 0;
    var cx = ball.velx + (ball.wy * crz - ball.wz * cry);
    var cz = ball.velz + (ball.wx * cry - ball.wy * crx);
    var gx = -SPIN_FRICTION * cx;
    var gz = -SPIN_FRICTION * cz;
    ball.velx += gx * dt;
    ball.velz += gz * dt;
    ball.wx += (cry * gz) / BALL_I * dt;
    ball.wy += (crz * gx - crx * gz) / BALL_I * dt;
    ball.wz += (-cry * gx) / BALL_I * dt;
    var damp = Math.exp(-GROUND_FRICTION * 0.4 * dt);
    ball.velx *= damp;
    ball.velz *= damp;
    ball.wx *= damp;
    ball.wy *= damp;
    ball.wz *= damp;
    if (hypot3(ball.velx, 0, ball.velz) < 8 && hypot3(ball.wx, ball.wy, ball.wz) < 0.2) {
      ball.velx = 0;
      ball.velz = 0;
      ball.wx = 0;
      ball.wy = 0;
      ball.wz = 0;
    }
    clampSpin(ball);
    integrateSpin(ball, dt);
    ball.x += ball.velx * dt;
    ball.z += ball.velz * dt;
    ball.x = clamp(ball.x, lx, rx);
    ball.z = clamp(ball.z, lz, rz);
    return;
  }

  var accel = { x: 0, y: grabbedBall ? -GRAVITY * 0.15 : -GRAVITY, z: 0, ax: 0, ay: 0, az: 0 };

  if (grabbedBall) {
    accel.x += (ptr.x - ball.x) * GRAB_K - ball.velx * GRAB_DAMP;
    accel.y += (ptr.y - ball.y) * GRAB_K - ball.vely * GRAB_DAMP;
    accel.z += (ptr.z - ball.z) * GRAB_K - ball.velz * GRAB_DAMP;
  } else {
    accel.x -= ball.velx * AIR_DRAG;
    accel.y -= ball.vely * AIR_DRAG;
    accel.z -= ball.velz * AIR_DRAG;
    accel.x += MAGNUS * (ball.wy * ball.velz - ball.wz * ball.vely);
    accel.y += MAGNUS * (ball.wz * ball.velx - ball.wx * ball.velz);
    accel.z += MAGNUS * (ball.wx * ball.vely - ball.wy * ball.velx);
    accel.ax -= ball.wx * SPIN_AIR;
    accel.ay -= ball.wy * SPIN_AIR;
    accel.az -= ball.wz * SPIN_AIR;
  }

  var floorPen = restY - ball.y;
  var leftPen = lx - ball.x;
  var rightPen = ball.x - rx;
  var backPen = lz - ball.z;
  var frontPen = ball.z - rz;

  addSpringContact(ball, 0, 1, 0, floorPen, accel);
  addSpringContact(ball, 1, 0, 0, leftPen, accel);
  addSpringContact(ball, -1, 0, 0, rightPen, accel);
  addSpringContact(ball, 0, 0, 1, backPen, accel);
  addSpringContact(ball, 0, 0, -1, frontPen, accel);

  ball.velx += accel.x * dt;
  ball.vely += accel.y * dt;
  ball.velz += accel.z * dt;
  ball.wx += accel.ax * dt;
  ball.wy += accel.ay * dt;
  ball.wz += accel.az * dt;
  clampSpin(ball);
  integrateSpin(ball, dt);

  var speed = hypot3(ball.velx, ball.vely, ball.velz);
  if (speed > MAX_SPEED) {
    var s = MAX_SPEED / speed;
    ball.velx *= s;
    ball.vely *= s;
    ball.velz *= s;
  }

  ball.x += ball.velx * dt;
  ball.y += ball.vely * dt;
  ball.z += ball.velz * dt;

  resolveMaxPen(ball, 0, 1, 0, restY);
  resolveMaxPen(ball, 1, 0, 0, lx);
  resolveMaxPen(ball, -1, 0, 0, -rx);
  resolveMaxPen(ball, 0, 0, 1, lz);
  resolveMaxPen(ball, 0, 0, -1, -rz);

  floorPen = restY - ball.y;
  if (!grabbedBall && floorPen > -REST_ALIGN && Math.abs(ball.vely) < REST_SPEED) {
    if (
      hypot3(ball.velx, 0, ball.velz) < REST_SPEED &&
      ball.y < restY + 2 &&
      ball.y > restY - REST_ALIGN
    ) {
      ball.grounded = true;
      ball.y = restY;
      ball.vely = 0;
      var restDamp = Math.exp(-GROUND_FRICTION * dt * 2);
      ball.velx *= restDamp;
      ball.velz *= restDamp;
      if (hypot3(ball.velx, 0, ball.velz) < 8) {
        ball.velx = 0;
        ball.velz = 0;
      }
    }
  } else if (ball.y > restY + 2 || grabbedBall) {
    ball.grounded = false;
  }
}

function resolveBallCollisions(dt) {
  var i;
  var j;
  for (i = 0; i < balls.length; i += 1) {
    balls[i].pairPenX = 0;
    balls[i].pairPenY = 0;
    balls[i].pairPenZ = 0;
  }
  for (i = 0; i < balls.length; i += 1) {
    for (j = i + 1; j < balls.length; j += 1) {
      var a = balls[i];
      var b = balls[j];
      var dx = a.x - b.x;
      var dy = a.y - b.y;
      var dz = a.z - b.z;
      var dist = hypot3(dx, dy, dz);
      if (dist < 1e-5) {
        dx = 1;
        dy = 0;
        dz = 0;
        dist = 1;
      }
      var pen = rad * 2 - dist;
      if (pen <= 0) {
        continue;
      }
      var inv = 1 / dist;
      var nx = dx * inv;
      var ny = dy * inv;
      var nz = dz * inv;
      a.pairPenX += pen * Math.abs(nx);
      a.pairPenY += pen * Math.abs(ny);
      a.pairPenZ += pen * Math.abs(nz);
      b.pairPenX += pen * Math.abs(nx);
      b.pairPenY += pen * Math.abs(ny);
      b.pairPenZ += pen * Math.abs(nz);

      var vRelN =
        (a.velx - b.velx) * nx + (a.vely - b.vely) * ny + (a.velz - b.velz) * nz;
      var vIn = -vRelN;
      var push = (SQUASH_K * pen + SQUASH_C * vIn) * dt;
      a.velx += nx * push;
      a.vely += ny * push;
      a.velz += nz * push;
      b.velx -= nx * push;
      b.vely -= ny * push;
      b.velz -= nz * push;

      if (Math.abs(ny) > 0.35 || pen > 8) {
        a.grounded = false;
        b.grounded = false;
      }

      if (pen > MAX_PEN) {
        var extra = (pen - MAX_PEN) * 0.5;
        a.x += nx * extra;
        a.y += ny * extra;
        a.z += nz * extra;
        b.x -= nx * extra;
        b.y -= ny * extra;
        b.z -= nz * extra;
        vRelN =
          (a.velx - b.velx) * nx + (a.vely - b.vely) * ny + (a.velz - b.velz) * nz;
        if (vRelN < 0) {
          var jimp = -vRelN * (1 + BOUNCE_E) * 0.5;
          a.velx += nx * jimp;
          a.vely += ny * jimp;
          a.velz += nz * jimp;
          b.velx -= nx * jimp;
          b.vely -= ny * jimp;
          b.velz -= nz * jimp;
        }
      }
    }
  }
}

function contactCompress(pen) {
  if (pen <= 0 || SQUASH_AMOUNT <= 0) {
    return 0;
  }
  return Math.min(pen / MAX_PEN, 1) * SQUASH_AMOUNT;
}

function updateSquash(ball) {
  var floorPen = Math.max(0, restY - ball.y);
  var wallPenX = Math.max(0, lx - ball.x, ball.x - rx);
  var wallPenZ = Math.max(0, lz - ball.z, ball.z - rz);
  var compressY = contactCompress(floorPen + ball.pairPenY);
  var compressX = contactCompress(wallPenX + ball.pairPenX);
  var compressZ = contactCompress(wallPenZ + ball.pairPenZ);
  // Flatten on the contact axis. Floor shortens; back wall flattens in Z, not Y.
  ball.sx = (1 + compressY + compressZ * 0.5) / (1 + compressX);
  ball.sy = (1 + compressX * 0.45 + compressZ * 0.5) / (1 + compressY);
  ball.sz = (1 + compressX * 0.45 + compressY) / (1 + compressZ);
}

function update(dt) {
  var i;
  for (i = 0; i < balls.length; i += 1) {
    integrate(balls[i], dt);
  }
  resolveBallCollisions(dt);
  for (i = 0; i < balls.length; i += 1) {
    updateSquash(balls[i]);
  }
}

function squashPivot(view) {
  var px = view.x;
  var py = view.y;
  var pz = view.z;
  if (view.y < restY - 0.5) {
    py = 0;
  }
  if (view.x < lx - 0.5) {
    px = WALL_LEFT;
  } else if (view.x > rx + 0.5) {
    px = WALL_RIGHT;
  }
  if (view.z < lz - 0.5) {
    pz = WALL_BACK;
  } else if (view.z > rz + 0.5) {
    pz = WALL_FRONT;
  }
  return { x: px, y: py, z: pz };
}

function visualCenter(view) {
  var vx = view.x;
  var vy = view.y;
  var vz = view.z;
  if (view.y < restY - 0.5) {
    vy = restY;
  }
  if (view.x < lx - 0.5) {
    vx = lx;
  } else if (view.x > rx + 0.5) {
    vx = rx;
  }
  if (view.z < lz - 0.5) {
    vz = lz;
  } else if (view.z > rz + 0.5) {
    vz = rz;
  }
  return { x: vx, y: vy, z: vz };
}

function syncView(ball, alpha) {
  var view = ball.view;
  var prevPose = ball.prevPose;
  view.x = lerp(prevPose.x, ball.x, alpha);
  view.y = lerp(prevPose.y, ball.y, alpha);
  view.z = lerp(prevPose.z, ball.z, alpha);
  view.sx = lerp(prevPose.sx, ball.sx, alpha);
  view.sy = lerp(prevPose.sy, ball.sy, alpha);
  view.sz = lerp(prevPose.sz, ball.sz, alpha);
  view.q.slerpQuaternions(prevPose.q, ball.q, alpha);
}

function drawBall(ball) {
  var view = ball.view;
  var pivot = squashPivot(view);
  var vis = visualCenter(view);
  ball.squashGroup.position.set(pivot.x, pivot.y, pivot.z);
  ball.squashGroup.scale.set(view.sx, view.sy, view.sz);
  ball.ballGroup.position.set(vis.x - pivot.x, vis.y - pivot.y, vis.z - pivot.z);
  ball.ballGroup.quaternion.copy(view.q);

  var height = Math.max(0, vis.y - restY);
  var grow = 1 + 0.5 * height / Math.max(ROOM_H, 1);
  ball.shadowMesh.position.x = vis.x;
  ball.shadowMesh.position.z = vis.z;
  ball.shadowMesh.scale.set(grow * view.sx, grow * 0.38 * view.sz, 1);
  ball.shadowMesh.material.opacity = 0.62 * (1 - Math.min(height / 1400, 0.85));
  return vis;
}

function draw() {
  var i;
  for (i = 0; i < balls.length; i += 1) {
    drawBall(balls[i]);
  }

  var t = strokePower();
  var showStroke = charging;
  var aimHit = null;
  if (ptrInitialized) {
    _ray.setFromCamera(_ndc, camera);
    if (pickBallFromRay(_chargeHit)) {
      aimHit = _chargeHit;
    }
  }
  if (showStroke) {
    strokeLine.material.color.setRGB(1, 0.72 + t * 0.2, 0.18);
    placeStrokeLine(strokeLine.material.color, 0.78 + t * 0.22);
    if (aimHit) {
      chargeMarker.visible = true;
      chargeMarker.position.copy(aimHit);
    } else {
      chargeMarker.visible = false;
    }
    chargeMarker.scale.setScalar(0.7 + t * 1.35);
    chargeMarker.material.color.copy(strokeLine.material.color);
    chargeMarker.material.opacity = 0.55 + t * 0.4;
    puckMesh.visible = true;
    puckMesh.position.copy(aimHit || ptr);
    puckMesh.lookAt(camera.position);
    puckMesh.scale.setScalar(1 + t * 1.8);
    puckMesh.material.color.copy(strokeLine.material.color);
    puckMesh.material.opacity = 0.4 + t * 0.5;
  } else if (ptrInitialized) {
    hideStrokeLine();
    chargeMarker.visible = false;
    puckMesh.visible = true;
    puckMesh.position.copy(aimHit || ptr);
    puckMesh.lookAt(camera.position);
    puckMesh.scale.setScalar(1);
    puckMesh.material.color.setRGB(0.07, 0.07, 0.07);
    puckMesh.material.opacity = overBall || grabbed ? 0.7 : 0.32;
  } else {
    hideStrokeLine();
    chargeMarker.visible = false;
    puckMesh.visible = false;
  }

  debugGroup.visible = SHOW_DEBUG;
  renderer.render(scene, camera);
}

function captureAllPoses() {
  var i;
  for (i = 0; i < balls.length; i += 1) {
    capturePose(balls[i]);
  }
}

function syncAllViews(alpha) {
  var i;
  for (i = 0; i < balls.length; i += 1) {
    syncView(balls[i], alpha);
  }
}

var lastRender = 0;
var accumulator = 0;

function loop(timestamp) {
  if (!lastRender) {
    lastRender = timestamp;
    captureAllPoses();
  }
  var frameDt = Math.min((timestamp - lastRender) / 1000, MAX_FRAME_DT);
  lastRender = timestamp;
  updateWalkCamera(frameDt);
  accumulator += frameDt;

  var steps = 0;
  while (accumulator >= FIXED_DT && steps < MAX_STEPS) {
    captureAllPoses();
    update(FIXED_DT);
    accumulator -= FIXED_DT;
    steps += 1;
  }
  if (steps === MAX_STEPS) {
    accumulator = 0;
    captureAllPoses();
  }

  syncAllViews(clamp(accumulator / FIXED_DT, 0, 1));
  draw();
  window.requestAnimationFrame(loop);
}

function bindParams() {
  var panel = document.getElementById("params");
  var squish = document.getElementById("squish");
  var squishVal = document.getElementById("squish-val");
  var weight = document.getElementById("weight");
  var weightVal = document.getElementById("weight-val");
  var magnus = document.getElementById("magnus");
  var magnusVal = document.getElementById("magnus-val");
  var arena = document.getElementById("arena");
  var arenaVal = document.getElementById("arena-val");
  var count = document.getElementById("ball-count");
  var countVal = document.getElementById("ball-count-val");
  var toggle = document.getElementById("params-toggle");
  function stopCanvas(event) {
    event.stopPropagation();
  }
  panel.addEventListener("pointerdown", stopCanvas);
  panel.addEventListener("pointerup", stopCanvas);
  panel.addEventListener("pointermove", stopCanvas);
  panel.addEventListener("wheel", stopCanvas, { passive: false });
  panel.addEventListener("contextmenu", stopCanvas);
  panel.addEventListener("change", function () {
    if (document.activeElement && panel.contains(document.activeElement)) {
      document.activeElement.blur();
    }
  });
  applySquishiness(Number(squish.value) / 100);
  squishVal.textContent = squish.value;
  squish.addEventListener("input", function () {
    applySquishiness(Number(squish.value) / 100);
    squishVal.textContent = squish.value;
  });
  applyBallWeight(Number(weight.value) / 100);
  weightVal.textContent = weight.value;
  weight.addEventListener("input", function () {
    applyBallWeight(Number(weight.value) / 100);
    weightVal.textContent = weight.value;
  });
  applyMagnus(Number(magnus.value) / 100);
  magnusVal.textContent = magnus.value;
  magnus.addEventListener("input", function () {
    applyMagnus(Number(magnus.value) / 100);
    magnusVal.textContent = magnus.value;
  });
  applyArenaSize(Number(arena.value));
  arenaVal.textContent = arena.value;
  arena.addEventListener("input", function () {
    applyArenaSize(Number(arena.value));
    arenaVal.textContent = arena.value;
  });
  count.addEventListener("input", function () {
    setBallCount(parseInt(count.value, 10));
    countVal.textContent = String(BALL_COUNT);
    captureAllPoses();
    syncAllViews(1);
  });
  toggle.addEventListener("click", function (event) {
    event.preventDefault();
    event.stopPropagation();
    var hidden = panel.classList.toggle("params-collapsed");
    toggle.textContent = hidden ? "Show" : "Hide";
    toggle.setAttribute("aria-expanded", hidden ? "false" : "true");
  });
}

setupScene();
resizeRenderer();
bindParams();
captureAllPoses();
syncAllViews(1);
handlers();
window.addEventListener("resize", function () {
  resizeRenderer();
  var i;
  for (i = 0; i < balls.length; i += 1) {
    if (balls[i].grounded) {
      balls[i].y = restY;
      balls[i].vely = 0;
    }
  }
  captureAllPoses();
  syncAllViews(1);
});
window.requestAnimationFrame(loop);
