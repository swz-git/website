// Generate fancy circuit pattern for the background of the site

const canvas = document.querySelector(".circuit-background");
const spacing = 28;
const blockSize = 3;
const directions = Array.from({ length: 8 }, (_, i) => {
    const angle = i * Math.PI / 4;
    return [Math.cos(angle), Math.sin(angle)];
});

const vertexShader = `
attribute vec2 position;
uniform vec2 resolution;
uniform float pixelRatio;
varying vec2 worldPosition;
void main() {
  worldPosition = position;
  vec2 screen = position * pixelRatio;
  gl_Position = vec4(screen.x / resolution.x * 2.0 - 1.0,
    1.0 - screen.y / resolution.y * 2.0, 0.0, 1.0);
}`;

const fragmentShader = `
precision mediump float;
uniform vec2 cursor;
uniform int mode;
varying vec2 worldPosition;
void main() {
  if (mode == 1) {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
  } else if (mode == 2) {
    float distanceToCursor = distance(worldPosition, cursor);
    if (distanceToCursor >= 160.0) discard;
    float falloff = 1.0 - smoothstep(0.0, 160.0, distanceToCursor);
    gl_FragColor = vec4(0.50, 0.8, 0.50, 0.78 * falloff * falloff);
  } else {
    gl_FragColor = vec4(0.02, 0.05, 0.02, 1.0);
  }
}`;

function fract(value) { return value - Math.floor(value); }
function hash(x, y) {
    const px = fract(x * 123.34);
    const py = fract(y * 456.21);
    const d = px * (px + 45.32) + py * (py + 45.32);
    return fract((px + d) * (py + d));
}
function mod(value, divisor) { return ((value % divisor) + divisor) % divisor; }
function isStart(x, y) {
    const bx = Math.floor(x / blockSize);
    const by = Math.floor(y / blockSize);
    const index = Math.floor(hash(bx * 1.37 + 0.7, by * 1.37 + 0.7) * blockSize * blockSize);
    return mod(x, blockSize) === index % blockSize && mod(y, blockSize) === Math.floor(index / blockSize);
}
function flow(x, y) {
    const gx = 0.21 * Math.cos(x * 0.21 + 1.7) * Math.sin(y * 0.19 + 0.4)
        + 0.112 * Math.cos((x - y) * 0.14 + 4.2) + 0.066 * Math.cos(x * 0.11 - y * 0.23 + 1.1);
    const gy = 0.19 * Math.sin(x * 0.21 + 1.7) * Math.cos(y * 0.19 + 0.4)
        - 0.112 * Math.cos((x - y) * 0.14 + 4.2) - 0.138 * Math.cos(x * 0.11 - y * 0.23 + 1.1);
    const fx = -gy;
    const fy = gx;
    const length = Math.hypot(fx, fy) + 0.05;
    return [fx / length, fy / length];
}

function circle(mesh, x, y, radius, segments = 12) {
    for (let i = 0; i < segments; i++) {
        const a = i * Math.PI * 2 / segments;
        const b = (i + 1) * Math.PI * 2 / segments;
        mesh.push(x, y, x + Math.cos(a) * radius, y + Math.sin(a) * radius,
            x + Math.cos(b) * radius, y + Math.sin(b) * radius);
    }
}
function segment(mesh, ax, ay, bx, by, width) {
    const dx = bx - ax, dy = by - ay;
    const px = -dy / Math.hypot(dx, dy) * width;
    const py = dx / Math.hypot(dx, dy) * width;
    mesh.push(ax + px, ay + py, bx + px, by + py, bx - px, by - py,
        ax + px, ay + py, bx - px, by - py, ax - px, ay - py);
}
function ring(mesh, x, y, inner, outer) {
    const segments = 32;
    for (let i = 0; i < segments; i++) {
        const a = i * Math.PI * 2 / segments, b = (i + 1) * Math.PI * 2 / segments;
        const ix = x + Math.cos(a) * inner, iy = y + Math.sin(a) * inner;
        const ox = x + Math.cos(a) * outer, oy = y + Math.sin(a) * outer;
        const jx = x + Math.cos(b) * inner, jy = y + Math.sin(b) * inner;
        const qx = x + Math.cos(b) * outer, qy = y + Math.sin(b) * outer;
        mesh.push(ix, iy, ox, oy, qx, qy, ix, iy, qx, qy, jx, jy);
    }
}

function makeMeshes(minX, minY, maxX, maxY) {
    const meshes = { traces: [], holes: [], rings: [], pads: [] };
    const traceWidth = 2.75, padRadius = 7.5, ringRadius = 6.5;
    for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
        const start = isStart(x, y);
        const padOnly = !start && hash(x + 5.5, y + 5.5) < 0.02;
        if (!start && !padOnly) continue;
        const steps = padOnly ? 0 : 4 + Math.floor(hash(x + 3.71, y + 3.71) * 4);
        const [fx, fy] = flow(x, y);
        let angle = mod(Math.floor(Math.atan2(fy, fx) * 1.2732395 + 0.5)
            + (hash(x + 7.77, y + 7.77) < 0.5 ? 0 : 4), 8);
        let px = x, py = y;
        const path = [[x * spacing, y * spacing]];
        const addPad = (cx, cy, isRing) => {
            if (isRing) {
                const inner = ringRadius - traceWidth;
                circle(meshes.holes, cx, cy, inner, 32);
                ring(meshes.rings, cx, cy, inner, ringRadius + traceWidth);
            } else circle(meshes.pads, cx, cy, padRadius, 24);
        };
        addPad(path[0][0], path[0][1], hash(x + 11.3, y + 11.3) < (padOnly ? 0.15 : 0.30));
        for (let step = 0; step < steps; step++) {
            const [vx, vy] = flow(px, py);
            let best = -Infinity;
            let nextX = px, nextY = py, nextAngle = angle;
            for (let turn = -1; turn <= 1; turn++) {
                const candidate = mod(angle + turn, 8), [dx, dy] = directions[candidate];
                const tx = px + Math.floor(dx + 0.5), ty = py + Math.floor(dy + 0.5);
                const score = Math.abs(dx * vx + dy * vy) + (turn === 0 ? 0.25 : 0)
                    + 0.75 * hash(x + step * 7.13 + turn * 1.31, y + step * 3.77)
                    - (isStart(tx, ty) ? 1.5 : 0);
                if (score > best) { best = score; nextAngle = candidate; nextX = tx; nextY = ty; }
            }
            angle = nextAngle; px = nextX; py = nextY;
            path.push([px * spacing, py * spacing]);
        }
        if (padOnly) continue;
        path.forEach(([cx, cy], i) => {
            circle(meshes.traces, cx, cy, traceWidth);
            if (i) segment(meshes.traces, ...path[i - 1], cx, cy, traceWidth);
        });
        const [ex, ey] = path[path.length - 1];
        addPad(ex, ey, hash(x + 13.9, y + 13.9) < 0.30);
    }
    return meshes;
}

function compile(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
    return shader;
}

if (canvas) {
    const gl = canvas.getContext("webgl", { alpha: true, antialias: true, stencil: true, powerPreference: "low-power" });
    if (gl) {
        const program = gl.createProgram();
        gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, vertexShader));
        gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, fragmentShader));
        gl.linkProgram(program);
        if (gl.getProgramParameter(program, gl.LINK_STATUS)) run(gl, program);
        else console.error("Circuit background shader failed to link:", gl.getProgramInfoLog(program));
    }
}

function run(gl, program) {
    const buffer = gl.createBuffer();
    const position = gl.getAttribLocation(program, "position");
    const resolution = gl.getUniformLocation(program, "resolution");
    const pixelRatio = gl.getUniformLocation(program, "pixelRatio");
    const cursor = gl.getUniformLocation(program, "cursor");
    const mode = gl.getUniformLocation(program, "mode");
    const ranges = {};
    let cachedBounds = "", ratio = 1, width = 0, height = 0;
    let pointer = [0, 0], glow = [0, 0], velocity = [0, 0], visible = false, lastTime = 0, pending = false;
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);

    function resize() {
        ratio = Math.min(window.devicePixelRatio || 1, 1.5);
        width = document.documentElement.clientWidth;
        height = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
        canvas.style.height = `${height}px`;
        const w = Math.max(1, Math.floor(width * ratio)), h = Math.max(1, Math.floor(height * ratio));
        if (canvas.width !== w || canvas.height !== h) {
            canvas.width = w; canvas.height = h; gl.viewport(0, 0, w, h); cachedBounds = "";
        }
    }
    function updateMeshes() {
        const bounds = `-${10},-${10},${Math.ceil(width / spacing) + 10},${Math.ceil(height / spacing) + 10}`;
        if (bounds === cachedBounds) return;
        const meshes = makeMeshes(-10, -10, Math.ceil(width / spacing) + 10, Math.ceil(height / spacing) + 10);
        let offset = 0;
        const totalFloats = Object.values(meshes).reduce((total, mesh) => total + mesh.length, 0);
        const vertices = new Float32Array(totalFloats);
        for (const name of ["traces", "holes", "rings", "pads"]) {
            const mesh = meshes[name];
            ranges[name] = [offset, mesh.length / 2];
            offset += mesh.length / 2;
            vertices.set(mesh, offset * 2 - mesh.length);
        }
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
        cachedBounds = bounds;
    }
    function drawMesh(name, drawMode) {
        const [first, count] = ranges[name] || [0, 0];
        if (count) { gl.uniform1i(mode, drawMode); gl.drawArrays(gl.TRIANGLES, first, count); }
    }
    function eraseHoles() {
        if (!ranges.holes?.[1]) return;
        gl.enable(gl.BLEND);
        gl.blendFuncSeparate(gl.ZERO, gl.ONE_MINUS_SRC_ALPHA, gl.ZERO, gl.ONE_MINUS_SRC_ALPHA);
        drawMesh("holes", 1);
        gl.disable(gl.BLEND);
    }
    function draw(time) {
        pending = false;
        const dt = lastTime ? Math.min((time - lastTime) / 1000, 0.05) : 0;
        lastTime = time;
        resize(); updateMeshes();
        if (visible && dt > 0) {
            const omega = 20, decay = Math.exp(-omega * dt);
            for (let i = 0; i < 2; i++) {
                const offset = glow[i] - pointer[i], temp = (velocity[i] + omega * offset) * dt;
                glow[i] = pointer[i] + (offset + temp) * decay;
                velocity[i] = (velocity[i] - omega * temp) * decay;
            }
            if (Math.abs(glow[0] - pointer[0]) < 0.2 && Math.abs(glow[1] - pointer[1]) < 0.2
                && Math.abs(velocity[0]) < 0.5 && Math.abs(velocity[1]) < 0.5) {
                glow = [...pointer]; velocity = [0, 0];
            } else requestDraw();
        }
        gl.clear(gl.COLOR_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
        gl.useProgram(program);
        gl.uniform2f(resolution, canvas.width, canvas.height);
        gl.uniform1f(pixelRatio, ratio);
        gl.uniform2f(cursor, ...glow);
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.enableVertexAttribArray(position);
        gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
        drawMesh("traces", 0); eraseHoles(); drawMesh("rings", 0); drawMesh("pads", 0);
        if (visible) {
            gl.enable(gl.STENCIL_TEST); gl.stencilMask(0xff);
            gl.stencilFunc(gl.NOTEQUAL, 1, 0xff); gl.stencilOp(gl.KEEP, gl.KEEP, gl.REPLACE);
            gl.enable(gl.BLEND);
            gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
            drawMesh("traces", 2); drawMesh("rings", 2); drawMesh("pads", 2);
            gl.disable(gl.BLEND); gl.disable(gl.STENCIL_TEST); eraseHoles();
        }
    }
    function requestDraw() {
        if (!pending) { pending = true; requestAnimationFrame(draw); }
    }
    window.addEventListener("pointermove", (event) => {
        if (event.pointerType === "touch") return;
        const pageX = event.clientX + window.scrollX;
        const pageY = event.clientY + window.scrollY;
        if (!visible) { glow = [pageX, pageY]; velocity = [0, 0]; }
        pointer = [pageX, pageY]; visible = true; requestDraw();
    }, { passive: true });
    const hideGlow = () => { visible = false; velocity = [0, 0]; requestDraw(); };
    window.addEventListener("pointerout", (event) => { if (!event.relatedTarget) hideGlow(); });
    window.addEventListener("blur", hideGlow);
    window.addEventListener("resize", requestDraw, { passive: true });
    requestDraw();
}
