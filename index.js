var glsl = require('glslify')

module.exports = TV

function TV(opts) {
  if (!(this instanceof TV)) return new TV(opts)
  this._regl = opts.regl
  var widths = Array.isArray(opts.width)
    ? opts.width : [ opts.width || 1024, opts.width || 1024]
  this.shadowMask = opts.shadowMask !== undefined ? opts.shadowMask : 0.1
  this._mtick = 0
  this._dtick = 0

  this._fbOpts = [262,263,262,263,525].map((height,i) => ({
    color: this._regl.texture({
      width: widths[i%2],
      height,
    })
  }))
  this._fbo = this._fbOpts.map(this._regl.framebuffer)
  this._nlines = 0
  this._src = 0
  this._dst = 0
  this._src0 = 0
  this._src1 = 0

  this._setfb = this._regl({
    framebuffer: () => this._fbo[this._dst]
  })
  this._setf = this._regl({
    framebuffer: () => this._fbo[this._dst],
    uniforms: {
      signal: () => this._fbo[this._src],
      n_lines: () => this._nlines,
    }
  })
  this._setd = this._regl({
    uniforms: {
      tick: () => this._dtick
    }
  })

  this._size = [0,0]
  this._mdraw = this._regl({
    frag: glsl`
      precision highp float;
      #pragma glslify: modulate = require('glsl-ntsc-video/modulate')
      varying vec2 vpos;
      uniform float n_lines;
      uniform sampler2D src;
      void main () {
        gl_FragColor = vec4(modulate(vpos*0.5+0.5, n_lines, src),0,0,1);
      }
    `,
    vert: `
      precision highp float;
      attribute vec2 position;
      varying vec2 vpos;
      void main () {
        vpos = position;
        gl_Position = vec4(position,0,1);
      }
    `,
    attributes: { position: [-4,-4,-4,+4,+4,+0] },
    elements: [0,1,2],
    framebuffer: this._regl.prop('framebuffer'),
    uniforms: {
      n_lines: this._regl.prop('n_lines'),
      src: () => this._fbo[4]
    }
  })
  this._ddraw = this._regl({
    frag: glsl`
      precision highp float;
      #pragma glslify: demodulate = require('glsl-ntsc-video/demodulate')
      uniform sampler2D signal0, signal1;
      varying vec2 vpos;
      uniform float tick, shadowMask;
      const float PI = ${Math.PI};
      const float L_TIME = 6.35555e-5;
      const float P_TIME = 5.26e-5;
      void main () {
        vec2 v = vpos*0.5+0.5;
        vec2 r = vec2(720, 485);
        vec3 rgb0 = demodulate(v, vec3(262,r), signal0);
        vec3 rgb1 = demodulate(v, vec3(263,r), signal1);
        vec3 rgb = mix(rgb0,rgb1,sin(v.y*PI*2.0*242.5)*0.5+0.5);
        float sy = floor(mod(v.x*r.x,2.0))/r.x*0.5;
        vec3 mask = vec3(
          step(mod(v.x*r.x*3.0+2.0,3.0),1.0),
          step(mod(v.x*r.x*3.0+1.0,3.0),1.0),
          step(mod(v.x*r.x*3.0+0.0,3.0),1.0)
        ) * (1.0-step(mod(((v.y+sy)*r.y)*3.0,3.0),0.5));
        vec3 c = mix(rgb,rgb*mask,shadowMask);
        //vec3 c = vec3(texture2D(signal0,v).x);
        gl_FragColor = vec4(c,1);
      }
    `,
    vert: `
      precision highp float;
      attribute vec2 position;
      varying vec2 vpos;
      void main () {
        vpos = position;
        gl_Position = vec4(position,0,1);
      }
    `,
    attributes: { position: [-4,-4,-4,+4,+4,+0] },
    elements: [0,1,2],
    uniforms: {
      signal0: this._regl.prop('signal0'),
      signal1: this._regl.prop('signal1'),
      tick: this._regl.context('tick'),
      size: (context) => {
        this._size[0] = context.viewportWidth
        this._size[1] = context.viewportWidth
        return this._size
      },
      shadowMask: () => this.shadowMask
    }
  })
}

TV.prototype._updateFb = function (n) {
  this._fbo[n](this._fbOpts[n])
}

TV.prototype.modulate = function (fn) {
  this._src0 = 0
  this._src1 = 1
  this._updateFb(4)
  this._dst = 4
  this._setfb(fn)
  this._dst = this._mtick%2
  this._updateFb(this._dst)
  this._nlines = this._mtick%2 ? 263 : 262
  this._mdraw({
    n_lines: this._nlines,
    framebuffer: this._fbo[this._dst]
  })
  this._mtick++
}

TV.prototype.filter = function (fn) {
  this._src = this._dst
  this._dst += 2
  this._updateFb(this._dst)
  this._setf(fn)
  this._src0 += 2
  this._src1 += 2
}

/* // todo:
TV.prototype.load = function (opts) {
  // opts.width
  // opts.height
  // opts.data
}

TV.prototype.sync = function (data) {
  this.vsync()
  this.hsync()
}

TV.prototype.vsync = function (data) {
}

TV.prototype.hsync = function (data) {
}
*/

TV.prototype.demodulate = function () {
  this._regl.poll()
  this._regl.clear({ color: [0,0,0,1], depth: true })
  this._setd(() => {
    this._ddraw({
      signal0: this._fbo[this._src0],
      signal1: this._fbo[this._src1],
    })
  })
}
