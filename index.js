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
        height: 242
      })
    },
    {
      color: this._regl.texture({
        format: 'rgba',
        type: 'float',
        width: widths[1],
        height: 243
      })
    }
  ]
  this._fboInOpts = {
    color: this._regl.texture({
      format: 'rgba',
      type: 'float',
      width: widths[0],
      height: 485
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
      #pragma glslify: modulate_uv = require('glsl-ntsc/modulate-uv')
      varying vec2 vpos;
      uniform float time, n_lines;
      uniform sampler2D inputTexture;
      const float L_TIME = 6.35555e-5;
      const float P_TIME = 5.26e-5;
      const float FP_TIME = 1.5e-6;
      const float SP_TIME = 4.7e-6;
      const float BW_TIME = 0.6e-6;
      const float CB_TIME = 2.5e-6;
      const float BP_TIME = 1.6e-6;
      const float CARRIER_HZ = 3579545.25;
      const float PI = ${Math.PI};
      void main () {
        //vec2 uv = vpos*0.5+0.5;
        //vec3 rgb = texture2D(inputTexture,uv).xyz;
        float v_lines = n_lines - 20.0;
        vec2 v = vpos*0.5+0.5;
        vec2 uv = v
          * vec2(L_TIME/P_TIME, n_lines/v_lines)
          - vec2((L_TIME-P_TIME)/P_TIME, 0)
        ;
        float hblank = step(v.x, (L_TIME-P_TIME)/L_TIME);
        float vblank = step(1.0-(n_lines-v_lines)/n_lines, v.y);

        float vt = 0.0;
        float fporch = step(v.x,FP_TIME/L_TIME);
        vt += FP_TIME/L_TIME;
        float syncpulse = step(vt,v.x) * step(v.x,vt+SP_TIME/L_TIME);
        vt += SP_TIME/L_TIME;
        float breezeway = step(vt,v.x) * step(v.x,vt+BW_TIME/L_TIME);
        vt += BW_TIME/L_TIME;
        float colorburst = step(vt,v.x) * step(v.x,vt+CB_TIME/L_TIME);
        vt += CB_TIME/L_TIME;
        float bporch = step(vt,v.x) * step(v.x,vt+BP_TIME/L_TIME);
        vec3 rgb = texture2D(inputTexture,uv).xyz * (1.0 - hblank);
        float signal = modulate_uv(v, n_lines, rgb);
        signal -= 40.0 * syncpulse;
        signal += sin(2.0*PI*CARRIER_HZ)*20.0*colorburst;
        signal *= 1.0 - vblank;
        signal -= 40.0 * vblank;
        gl_FragColor = vec4(signal,0,0,1);
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
      time: this._regl.context('time'),
      n_lines: this._regl.prop('n_lines'),
      inputTexture: () => this._fboIn
    }
  })
  this._ddraw = this._regl({
    frag: glsl`
      precision highp float;
      #pragma glslify: demodulate_uv = require('glsl-ntsc/demodulate-uv')
      uniform sampler2D signal0, signal1;
      varying vec2 vpos;
      uniform float tick, shadowMask;
      uniform vec2 size;
      const float PI = ${Math.PI};
      const float L_TIME = 6.35555e-5;
      const float P_TIME = 5.26e-5;
      void main () {
        vec2 uv0 = (vpos*0.5+0.5)
          * vec2(P_TIME/L_TIME, 242.0/262.0)
          - vec2(P_TIME/L_TIME, 0)
        ;
        vec2 uv1 = (vpos*0.5+0.5)
          * vec2(P_TIME/L_TIME, 243.0/263.0)
          - vec2(P_TIME/L_TIME, 0)
        ;
        vec2 r = vec2(720,485);
        float odd = floor(mod(uv0.x*r.x,2.0));
        float sy = odd/r.y*0.5;
        vec2 ruv0 = vec2(
          floor(uv0.x*r.x+0.5)/r.x,
          floor(uv0.y*r.y+odd*0.5)/r.y
        );
        vec2 ruv1 = vec2(
          floor(uv1.x*r.x+0.5)/r.x,
          floor(uv1.y*r.y+odd*0.5)/r.y
        );
        float fade = 0.5;
        vec3 rgb0 = demodulate_uv(ruv0, 242.0, signal0) * mix(fade,1.0,mod(tick,2.0));
        vec3 rgb1 = demodulate_uv(ruv1, 243.0, signal1) * mix(1.0,fade,mod(tick,2.0));
        vec3 rgb = mix(rgb0,rgb1,sin((uv0.y+uv1.y)*0.5*PI*2.0*242.5)*0.5+0.5);
        vec3 mask = vec3(
          step(mod(uv0.x*r.x*3.0+2.0,3.0),1.0),
          step(mod(uv0.x*r.x*3.0+1.0,3.0),1.0),
          step(mod(uv0.x*r.x*3.0+0.0,3.0),1.0)
        ) * (1.0-step(mod(((uv0.y+sy)*r.y)*3.0,3.0),0.5));
        vec3 c = pow(mix(rgb,rgb*mask,shadowMask), vec3(0.45));
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
    n_lines: this._mtick%2 ? 243 : 242
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
