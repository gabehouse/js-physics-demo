var canvas = document.getElementById("canvas");
var ctx = canvas.getContext("2d", {
  alpha: false,
  desynchronized: true
});

var width;
var height;
var skyx, skyy, skyw, skyh, gx, gy, gw, gh, fy;
var lx, rx;
var tgrd, bgrd;

var rad = 150;
var SHOW_DEBUG = false;

// Fixed-step simulation so motion is the same on 60 Hz and 144 Hz displays.
var FIXED_DT = 1 / 120;
var MAX_FRAME_DT = 0.05;
var MAX_STEPS = 8;

var GRAVITY = 2020;
var MAX_SPEED = 4200;
var AIR_DRAG = 0.06;
var CONTACT_FRICTION = 1.2;
var GROUND_FRICTION = 2.8;
var REST_SPEED = 48;
var REST_ALIGN = 8;
var BOUNCE_E = 0.7;

// How flat the ball looks at full compression. 0 = always a circle, 0.4 = strong pancake.
var SQUASH_AMOUNT = 0.25;
var SQUASH_K = 720;
var SQUASH_C = 7.4;
var MAX_PEN = rad * 0.42;

var GRAB_K = 72;
var GRAB_DAMP = 13;
var POKE_SPEED = 680;
var HIT_LOOKBACK = 56;
var HIT_NOISE = 70;
// Fastest downward strike we expect (canvas px/s). Maps to a bounce near the top.
var MAX_SLAM_CURSOR = 12000;
var BALL_I = 0.4 * rad * rad;
var SPIN_FRICTION = 5.2;
var SPIN_AIR = 0.18;
var MAGNUS = 0.00014;
var MAX_OMEGA = 26;
var HIT_SPIN = 1;

var ptrX = 0;
var ptrY = 0;
var prevPtrX = 0;
var prevPtrY = 0;
var ptrPath = [];
var ptrInitialized = false;
var ptrInside = false;
var grabbed = false;
var grabMoved = false;
var grabStartedAt = 0;
var pointerDown = false;
var overBall = false;

var sx = 1;
var sy = 1;
var drawScaleX = 1;
var drawScaleY = 1;

var state = {
  x: 0,
  y: 0,
  velx: 0,
  vely: 0,
  angle: 0,
  omega: 0,
  grounded: true
};

var prevPose = { x: 0, y: 0, sx: 1, sy: 1, angle: 0 };
var view = { x: 0, y: 0, sx: 1, sy: 1, angle: 0 };

function capturePose(target) {
  target.x = state.x;
  target.y = state.y;
  target.sx = sx;
  target.sy = sy;
  target.angle = state.angle;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function lerpAngle(a, b, t) {
  var d = b - a;
  while (d > Math.PI) {
    d -= Math.PI * 2;
  }
  while (d < -Math.PI) {
    d += Math.PI * 2;
  }
  return a + d * t;
}

function clampSpin() {
  if (state.omega > MAX_OMEGA) {
    state.omega = MAX_OMEGA;
  } else if (state.omega < -MAX_OMEGA) {
    state.omega = -MAX_OMEGA;
  }
}

function wrapAngle() {
  var tau = Math.PI * 2;
  state.angle = state.angle % tau;
  if (state.angle < 0) {
    state.angle += tau;
  }
}

function setWorldTransform(a, d, e, f) {
  ctx.setTransform(drawScaleX * a, 0, 0, drawScaleY * d, drawScaleX * e, drawScaleY * f);
}

function squashPivot() {
  var px = view.x;
  var py = view.y;
  if (view.y > fy + 0.5) {
    py = fy + rad;
  }
  if (view.x < lx - 0.5) {
    px = lx - rad;
  } else if (view.x > rx + 0.5) {
    px = rx + rad;
  }
  return { x: px, y: py };
}

function layout() {
  var cssW = window.innerWidth;
  var cssH = window.innerHeight;
  width = 2 * cssW;
  height = 2 * cssH;

  var dpr = window.devicePixelRatio || 1;
  if (dpr > 1.25) {
    dpr = 1.25;
  }
  var maxPixels = 2560 * 1440;
  if (cssW * cssH * dpr * dpr > maxPixels) {
    dpr = Math.sqrt(maxPixels / Math.max(cssW * cssH, 1));
  }
  canvas.width = Math.max(1, Math.round(cssW * dpr));
  canvas.height = Math.max(1, Math.round(cssH * dpr));
  drawScaleX = canvas.width / width;
  drawScaleY = canvas.height / height;

  skyx = 0;
  skyy = 0;
  skyw = width;
  skyh = height * 2 / 3;
  gx = 0;
  gy = height * 2 / 3;
  gw = width;
  gh = height * 1 / 3;
  fy = gy;
  lx = rad - 5;
  rx = width - rad + 5;

  tgrd = ctx.createLinearGradient(skyx, skyy, skyx, skyh);
  tgrd.addColorStop(0, "white");
  tgrd.addColorStop(1, "#0A0A0A");
  bgrd = ctx.createLinearGradient(gx, gy, gx, height);
  bgrd.addColorStop(0, "#0A0A0A");
  bgrd.addColorStop(1, "#f2f2f2");

  state.x = clamp(state.x || width / 2 + 500, lx, rx);
  state.y = state.y ? Math.min(state.y, fy + MAX_PEN) : fy;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function canvasPoint(clientX, clientY) {
  var rect = canvas.getBoundingClientRect();
  return {
    x: (clientX - rect.left) * (width / rect.width),
    y: (clientY - rect.top) * (height / rect.height)
  };
}

function pointInBall(px, py) {
  var dx = (px - state.x) / (rad * sx);
  var dy = (py - state.y) / (rad * sy);
  return dx * dx + dy * dy <= 1;
}

function updateHover(px, py) {
  overBall = pointInBall(px, py);
  if (grabbed) {
    canvas.style.cursor = "grabbing";
  } else if (overBall) {
    canvas.style.cursor = "grab";
  } else {
    canvas.style.cursor = "default";
  }
}

function wakeBall() {
  state.grounded = false;
}

function topBounceSpeed() {
  var travel = Math.max(fy - 36, 480);
  return Math.sqrt(2 * GRAVITY * travel) * 1.08;
}

function maxImpactSpeed() {
  return topBounceSpeed() / BOUNCE_E;
}

function mapHitSpeed(speed) {
  if (speed < HIT_NOISE) {
    return 0;
  }
  return Math.min(speed, MAX_SLAM_CURSOR) * (maxImpactSpeed() / MAX_SLAM_CURSOR);
}

function applyHitSpin(vx, vy) {
  var rx = ptrX - state.x;
  var ry = ptrY - state.y;
  if (rx * rx + ry * ry < 80) {
    return;
  }
  var jx = vx - state.velx;
  var jy = vy - state.vely;
  state.omega += (rx * jy - ry * jx) * HIT_SPIN / BALL_I;
  clampSpin();
}

function hitBall(vx, vy) {
  applyHitSpin(vx, vy);
  wakeBall();
  state.velx = clamp(vx, -MAX_SPEED, MAX_SPEED);
  state.vely = clamp(vy, -MAX_SPEED, MAX_SPEED);
}

function notePtrPos(x, y, now) {
  ptrPath.push({ t: now, x: x, y: y });
  var cutoff = now - 140;
  while (ptrPath.length > 2 && ptrPath[0].t < cutoff) {
    ptrPath.shift();
  }
}

function swingVelocity() {
  if (ptrPath.length < 2) {
    return { vx: 0, vy: 0, speed: 0 };
  }
  var newest = ptrPath[ptrPath.length - 1];
  var sample = ptrPath[0];
  var i;
  for (i = 0; i < ptrPath.length - 1; i += 1) {
    if (newest.t - ptrPath[i].t >= HIT_LOOKBACK) {
      sample = ptrPath[i];
    }
  }
  var dt = (newest.t - sample.t) / 1000;
  if (dt < 0.016) {
    return { vx: 0, vy: 0, speed: 0 };
  }
  var vx = (newest.x - sample.x) / dt;
  var vy = (newest.y - sample.y) / dt;
  if (!isFinite(vx) || !isFinite(vy)) {
    return { vx: 0, vy: 0, speed: 0 };
  }
  return { vx: vx, vy: vy, speed: Math.hypot(vx, vy) };
}

function tryBatHit() {
  if (grabbed || !overBall) {
    return;
  }
  var swing = swingVelocity();
  var mapped = mapHitSpeed(swing.speed);
  if (mapped < 40) {
    return;
  }
  var toX = state.x - ptrX;
  var toY = state.y - ptrY;
  var intoBall = swing.vx * toX + swing.vy * toY;
  var entering = !ptrInside;
  if (!entering && intoBall <= 0) {
    return;
  }
  var inv = 1 / swing.speed;
  var ballAlong = state.velx * swing.vx * inv + state.vely * swing.vy * inv;
  if (mapped <= Math.max(ballAlong, 0) + 40) {
    return;
  }
  hitBall(swing.vx * inv * mapped, swing.vy * inv * mapped);
}

function trackPointer(clientX, clientY, dt) {
  var point = canvasPoint(clientX, clientY);
  if (!ptrInitialized) {
    ptrX = point.x;
    ptrY = point.y;
    prevPtrX = point.x;
    prevPtrY = point.y;
    ptrInitialized = true;
    updateHover(ptrX, ptrY);
    notePtrPos(ptrX, ptrY, performance.now());
    ptrInside = overBall;
    return;
  }
  prevPtrX = ptrX;
  prevPtrY = ptrY;
  ptrX = point.x;
  ptrY = point.y;
  updateHover(ptrX, ptrY);
  notePtrPos(ptrX, ptrY, performance.now());

  if (pointerDown && (Math.abs(ptrX - prevPtrX) > 6 || Math.abs(ptrY - prevPtrY) > 6)) {
    grabMoved = true;
  }
  if (grabbed) {
    var grx = ptrX - state.x;
    var gry = ptrY - state.y;
    state.omega += (grx * (ptrY - prevPtrY) - gry * (ptrX - prevPtrX)) * 18 / BALL_I;
    clampSpin();
  }

  tryBatHit();
  ptrInside = overBall;
}

function onPointerDown(event) {
  if (event.pointerType === "mouse" && event.button !== 0) {
    return;
  }
  var point = canvasPoint(event.clientX, event.clientY);
  ptrX = point.x;
  ptrY = point.y;
  prevPtrX = point.x;
  prevPtrY = point.y;
  ptrInitialized = true;
  updateHover(ptrX, ptrY);
  notePtrPos(ptrX, ptrY, performance.now());
  pointerDown = true;
  grabMoved = false;
  grabStartedAt = performance.now();
  if (overBall) {
    grabbed = true;
    wakeBall();
    canvas.setPointerCapture(event.pointerId);
    event.preventDefault();
  }
}

function onPointerMove(event) {
  var dt = lastPointerMoveAt ? (event.timeStamp - lastPointerMoveAt) / 1000 : FIXED_DT;
  lastPointerMoveAt = event.timeStamp;
  trackPointer(event.clientX, event.clientY, clamp(dt, 1 / 240, 0.05));
  if (grabbed) {
    event.preventDefault();
  }
}

function releaseBall(wasTap) {
  if (!grabbed) {
    pointerDown = false;
    return;
  }
  grabbed = false;
  pointerDown = false;
  wakeBall();
  if (wasTap) {
    var awayX = state.x - ptrX;
    var awayY = state.y - ptrY;
    var dist = Math.hypot(awayX, awayY) || 1;
    hitBall(
      (awayX / dist) * POKE_SPEED * 0.45,
      (awayY / dist) * POKE_SPEED * 0.35 - POKE_SPEED * 0.7
    );
  } else {
    var swing = swingVelocity();
    var mapped = mapHitSpeed(swing.speed);
    if (mapped > 40) {
      hitBall(
        swing.vx / swing.speed * mapped,
        swing.vy / swing.speed * mapped
      );
    }
  }
}

function onPointerUp(event) {
  var heldFor = performance.now() - grabStartedAt;
  var wasTap = grabbed && !grabMoved && heldFor < 240;
  releaseBall(wasTap);
  updateHover(ptrX, ptrY);
  if (event.cancelable) {
    event.preventDefault();
  }
}

function onPointerCancel() {
  releaseBall(false);
}

var lastPointerMoveAt = 0;

function handlers() {
  canvas.style.touchAction = "none";
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerCancel);
  canvas.addEventListener("lostpointercapture", onPointerCancel);
  window.addEventListener("blur", function () {
    releaseBall(false);
  });
}

function contactAccel(pen, vel, k, c) {
  return -k * pen - c * vel;
}

function integrate(dt) {
  if (state.grounded && !grabbed) {
    state.y = fy;
    state.vely = 0;
    var slip = state.velx - state.omega * rad;
    var grip = -SPIN_FRICTION * slip;
    state.velx += grip * dt;
    state.omega += (-grip * rad / BALL_I) * dt;
    state.velx *= Math.exp(-GROUND_FRICTION * 0.4 * dt);
    state.omega *= Math.exp(-GROUND_FRICTION * 0.4 * dt);
    if (Math.abs(state.velx) < 8 && Math.abs(state.omega) < 0.2) {
      state.velx = 0;
      state.omega = 0;
    }
    clampSpin();
    state.angle += state.omega * dt;
    wrapAngle();
    state.x += state.velx * dt;
    state.x = clamp(state.x, lx, rx);
    return;
  }

  var ax = 0;
  var ay = grabbed ? GRAVITY * 0.15 : GRAVITY;
  var alpha = 0;

  if (grabbed) {
    ax += (ptrX - state.x) * GRAB_K - state.velx * GRAB_DAMP;
    ay += (ptrY - state.y) * GRAB_K - state.vely * GRAB_DAMP;
  } else {
    ax -= state.velx * AIR_DRAG;
    ay -= state.vely * AIR_DRAG;
    ax += MAGNUS * state.omega * state.vely;
    ay -= MAGNUS * state.omega * state.velx;
    alpha -= state.omega * SPIN_AIR;
  }

  var floorPen = state.y - fy;
  var leftPen = lx - state.x;
  var rightPen = state.x - rx;

  if (floorPen > 0) {
    ay += contactAccel(floorPen, state.vely, SQUASH_K, SQUASH_C);
    if (!grabbed) {
      var floorSlip = state.velx - state.omega * rad;
      var floorGrip = -SPIN_FRICTION * floorSlip;
      ax += floorGrip;
      alpha += -floorGrip * rad / BALL_I;
    }
  }
  if (leftPen > 0) {
    ax += -contactAccel(leftPen, -state.velx, SQUASH_K, SQUASH_C);
    if (!grabbed) {
      var leftSlip = state.vely + state.omega * rad;
      var leftGrip = -SPIN_FRICTION * leftSlip;
      ay += leftGrip;
      alpha += leftGrip * rad / BALL_I;
    }
  }
  if (rightPen > 0) {
    ax += contactAccel(rightPen, state.velx, SQUASH_K, SQUASH_C);
    if (!grabbed) {
      var rightSlip = state.vely - state.omega * rad;
      var rightGrip = -SPIN_FRICTION * rightSlip;
      ay += rightGrip;
      alpha += -rightGrip * rad / BALL_I;
    }
  }

  state.velx += ax * dt;
  state.vely += ay * dt;
  state.omega += alpha * dt;
  clampSpin();
  state.angle += state.omega * dt;
  wrapAngle();

  var speed = Math.hypot(state.velx, state.vely);
  if (speed > MAX_SPEED) {
    state.velx *= MAX_SPEED / speed;
    state.vely *= MAX_SPEED / speed;
  }

  state.x += state.velx * dt;
  state.y += state.vely * dt;

  if (state.y > fy + MAX_PEN) {
    state.y = fy + MAX_PEN;
    if (state.vely > 0) {
      state.vely = -state.vely * BOUNCE_E;
    }
  }
  if (state.x < lx - MAX_PEN) {
    state.x = lx - MAX_PEN;
    if (state.velx < 0) {
      state.velx = -state.velx * BOUNCE_E;
    }
  }
  if (state.x > rx + MAX_PEN) {
    state.x = rx + MAX_PEN;
    if (state.velx > 0) {
      state.velx = -state.velx * BOUNCE_E;
    }
  }

  if (!grabbed && floorPen > -REST_ALIGN && Math.abs(state.vely) < REST_SPEED) {
    if (Math.abs(state.velx) < REST_SPEED && state.y > fy - 2 && state.y < fy + REST_ALIGN) {
      state.grounded = true;
      state.y = fy;
      state.vely = 0;
      state.velx *= Math.exp(-GROUND_FRICTION * dt * 2);
      if (Math.abs(state.velx) < 8) {
        state.velx = 0;
      }
    }
  } else if (state.y < fy - 2 || grabbed) {
    state.grounded = false;
  }
}

function contactCompress(pen) {
  if (pen <= 0 || SQUASH_AMOUNT <= 0) {
    return 0;
  }
  return Math.min(pen / MAX_PEN, 1) * SQUASH_AMOUNT;
}

function updateSquash(dt) {
  var floorPen = Math.max(0, state.y - fy);
  var wallPen = Math.max(0, lx - state.x, state.x - rx);
  var compressY = contactCompress(floorPen);
  var compressX = contactCompress(wallPen);

  sx = (1 + compressY) / (1 + compressX);
  sy = (1 + compressX) / (1 + compressY);
}

function update(dt) {
  integrate(dt);
  updateSquash(dt);
}

function drawBackground() {
  ctx.fillStyle = tgrd;
  ctx.fillRect(skyx, skyy, skyw, skyh);
  ctx.fillStyle = bgrd;
  ctx.fillRect(gx, gy, gw, gh);
}

function drawCircle() {
  ctx.beginPath();
  ctx.ellipse(view.x, view.y, rad, rad, 0, 0, 2 * Math.PI);
  ctx.fillStyle = "black";
  ctx.lineWidth = 8;
  ctx.stroke();
  ctx.fillStyle = "yellow";
  ctx.fill();
}

function drawSpinMark() {
  var c = Math.cos(view.angle);
  var s = Math.sin(view.angle);
  ctx.strokeStyle = "rgba(25, 25, 25, 0.92)";
  ctx.lineCap = "round";
  ctx.lineWidth = 16;
  ctx.beginPath();
  ctx.moveTo(view.x - rad * c, view.y - rad * s);
  ctx.lineTo(view.x + rad * c, view.y + rad * s);
  ctx.stroke();
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.moveTo(view.x + rad * 0.42 * s, view.y - rad * 0.42 * c);
  ctx.lineTo(view.x - rad * 0.42 * s, view.y + rad * 0.42 * c);
  ctx.stroke();
}

function drawShading() {
  var k = 10 * 2;
  var y1 = view.y + 5 * 2;
  var x1 = -Math.sqrt(rad * rad - (y1 - view.y) * (y1 - view.y)) + view.x;
  var y2 = view.y + 35 * 2;
  var x2 = Math.sqrt(rad * rad - (y2 - view.y) * (y2 - view.y)) + view.x;
  var m = -1 / ((y2 - y1) / (x2 - x1));
  var mx = (x1 + x2) / 2;
  var my = (y1 + y2) / 2;
  var cx = mx - k;
  var cy = my - k * m;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.strokeStyle = "black";
  ctx.quadraticCurveTo(cx, cy, x2, y2);
  var a1 = Math.atan((y2 - view.y) / (x2 - view.x));
  var a2 = Math.atan((y1 - view.y) / (x1 - view.x)) - Math.PI;
  ctx.arc(view.x, view.y, rad, a1, a2);
  ctx.fillStyle = "rgba(102, 102, 102, 0.6)";
  ctx.fill();
}

function drawShadow() {
  ctx.beginPath();
  var xr = rad * (1 + 0.5 * (fy - view.y) / fy);
  var yr = (rad / 3) * (1 + 0.3 * (fy - view.y) / fy);
  ctx.ellipse(view.x, fy + rad, xr, yr, 0, 0, 2 * Math.PI);
  ctx.fillStyle = "rgba(20, 20, 20, 0.8)";
  ctx.fill();
}

function drawDebug() {
  setWorldTransform(1, 1, 0, 0);
  ctx.strokeStyle = "rgba(255, 80, 80, 0.8)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, fy);
  ctx.lineTo(width, fy);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(lx, 0);
  ctx.lineTo(lx, height);
  ctx.moveTo(rx, 0);
  ctx.lineTo(rx, height);
  ctx.stroke();
}

function draw() {
  var pivot = squashPivot();
  setWorldTransform(1, 1, 0, 0);
  drawBackground();
  setWorldTransform(view.sx, 1, pivot.x * (1 - view.sx), 0);
  drawShadow();
  setWorldTransform(view.sx, view.sy, pivot.x * (1 - view.sx), pivot.y * (1 - view.sy));
  drawCircle();
  drawSpinMark();
  drawShading();
  setWorldTransform(1, 1, 0, 0);
  if (SHOW_DEBUG) {
    drawDebug();
  }
}

function syncView(alpha) {
  view.x = lerp(prevPose.x, state.x, alpha);
  view.y = lerp(prevPose.y, state.y, alpha);
  view.sx = lerp(prevPose.sx, sx, alpha);
  view.sy = lerp(prevPose.sy, sy, alpha);
  view.angle = lerpAngle(prevPose.angle, state.angle, alpha);
}

function loop(timestamp) {
  if (!lastRender) {
    lastRender = timestamp;
    capturePose(prevPose);
    capturePose(view);
  }
  var frameDt = Math.min((timestamp - lastRender) / 1000, MAX_FRAME_DT);
  lastRender = timestamp;
  accumulator += frameDt;

  var steps = 0;
  while (accumulator >= FIXED_DT && steps < MAX_STEPS) {
    capturePose(prevPose);
    update(FIXED_DT);
    accumulator -= FIXED_DT;
    steps += 1;
  }
  if (steps === MAX_STEPS) {
    accumulator = 0;
    capturePose(prevPose);
  }

  syncView(clamp(accumulator / FIXED_DT, 0, 1));
  draw();
  window.requestAnimationFrame(loop);
}

window.onresize = function () {
  var wasGrounded = state.grounded;
  layout();
  if (wasGrounded) {
    state.y = fy;
    state.vely = 0;
  }
  capturePose(prevPose);
  capturePose(view);
};

layout();
capturePose(prevPose);
capturePose(view);
handlers();
var lastRender = 0;
var accumulator = 0;
window.requestAnimationFrame(loop);
