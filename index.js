var glsl = require('glslify')

module.exports = TV

function TV(opts) {
  if (!(this instanceof TV)) return new TV(opts)
  this._regl = opts.regl
  var m = 2
  var widths = Array.isArray(opts.width)
    ? opts.width : [ opts.width || 720*m-4, opts.width || 720*m-12 ]
  this.shadowMask = opts.shadowMask !== undefined ? opts.shadowMask : 0.1
  this._mtick = 0
  this._dtick = 0
  this._fbopts = [
    {
      color: this._regl.texture({
        format: 'rgba',
        type: 'float',
        width: widths[0],
        height: 262
      })
    },
    {
      color: this._regl.texture({
        format: 'rgba',
        type: 'float',
        width: widths[1],
        height: 263
      })
    }
  ]
  this._fboInOpts = {
    color: this._regl.texture({
      format: 'rgba',
      type: 'float',
      width: widths[0],
      height: 525
    })
  }
  this._fboIn = this._regl.framebuffer()
  this._fbo = [
    this._regl.framebuffer(this._fbopts[0]),
    this._regl.framebuffer(this._fbopts[1])
  ]
  this._setm = this._regl({
    framebuffer: () => this._fboIn
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
      uniform sampler2D inputTexture;
      void main () {
        gl_FragColor = vec4(modulate(vpos*0.5+0.5, n_lines, inputTexture),0,0,1);
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
      inputTexture: () => this._fboIn
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
        vec2 r = vec2(720, 525);
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

TV.prototype.modulate = function (fn) {
  this._fboIn(this._fboInOpts)
  this._setm(fn)
  this._fbo[this._mtick%2](this._fbopts[this._mtick%2])
  this._mdraw({
    framebuffer: this._fbo[this._mtick%2],
    n_lines: this._mtick%2 ? 263 : 262
  })
  this._mtick++
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
      signal0: this._fbo[0],
      signal1: this._fbo[1],
    })
  })
}
