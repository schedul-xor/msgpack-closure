goog.provide('uupaa.MsgPack');



/**
 * MsgPack for JavaScript
 *
 * @constructor
 * @author {uupaa<uupaa.js@gmail.com>}
 * @version {1.05}
 */
uupaa.MsgPack = function(){
    var i = 0,
        v;

    for (; i < 0x100; ++i) {
      v = this._toString(i);
      this._bin2num[v] = i; // "\00" -> 0x00
      this._num2bin[i] = v; //     0 -> "\00"
    }
    // http://twitter.com/edvakf/statuses/15576483807
    for (i = 0x80; i < 0x100; ++i) { // [Webkit][Gecko]
      this._bin2num[this._toString(0xf700 + i)] = i; // "\f780" -> 0x80
    }
};
goog.addSingletonGetter(uupaa.MsgPack);


/**
 * @param {!*} data
 * @param {!boolean} isToString
 * @return {!string}
 */
uupaa.MsgPack.prototype.pack = function(data,isToString){
    //  [1][mix to String]    msgpack.pack({}, true) -> "..."
    //  [2][mix to ByteArray] msgpack.pack({})       -> [...]
    this._error = 0;
    var byteArray = this.encode([], data, 0);
    return this._error ? false : isToString ? this.byteArrayToByteString(byteArray) : byteArray;
};


/**
 * @param {!*} data
 * @return {!*}
 */
uupaa.MsgPack.prototype.unpack = function(data){
    //  [1][String to mix]    msgpack.unpack("...") -> {}
    //  [2][ByteArray to mix] msgpack.unpack([...]) -> {}
    this._buf = typeof data === "string" ? this.toByteArray(data) : data;
    this._idx = -1;
    return this.decode(); // mix or undefined
};


/**
 * @param {!Array.<*>} rv
 * @param {!*} mix
 * @param {!number} depth
 */
uupaa.MsgPack.prototype.encode = function(rv,mix,depth){
    var size, i, iz, c, pos, // for UTF8.encode, Array.encode, Hash.encode
    high, low, sign, exp, frac; // for IEEE754
    if (mix == null) { // null or undefined -> 0xc0 ( null )
      rv.push(0xc0);
    } else if (mix === false) { // false -> 0xc2 ( false )
      rv.push(0xc2);
    } else if (mix === true) { // true  -> 0xc3 ( true  )
      rv.push(0xc3);
    } else {
      switch (typeof mix) {
      case "number":
        if (mix !== mix) { // isNaN
          rv.push(0xcb, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff); // quiet NaN
        } else if (mix === Infinity) {
          rv.push(0xcb, 0x7f, 0xf0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00); // positive infinity
        } else if (Math.floor(mix) === mix) { // int or uint
          if (mix < 0) {
            // int
            if (mix >= -32) { // negative fixnum
              rv.push(0xe0 + mix + 32);
            } else if (mix > -0x80) {
              rv.push(0xd0, mix + 0x100);
            } else if (mix > -0x8000) {
              mix += 0x10000;
              rv.push(0xd1, mix >> 8, mix & 0xff);
            } else if (mix > -0x80000000) {
              mix += 0x100000000;
              rv.push(0xd2, mix >>> 24, (mix >> 16) & 0xff, (mix >> 8) & 0xff, mix & 0xff);
            } else {
              high = Math.floor(mix / 0x100000000);
              low = mix & 0xffffffff;
              rv.push(0xd3, (high >> 24) & 0xff, (high >> 16) & 0xff, (high >> 8) & 0xff, high & 0xff, (low >> 24) & 0xff, (low >> 16) & 0xff, (low >> 8) & 0xff, low & 0xff);
            }
          } else {
            // uint
            if (mix < 0x80) {
              rv.push(mix); // positive fixnum
            } else if (mix < 0x100) { // uint 8
              rv.push(0xcc, mix);
            } else if (mix < 0x10000) { // uint 16
              rv.push(0xcd, mix >> 8, mix & 0xff);
            } else if (mix < 0x100000000) { // uint 32
              rv.push(0xce, mix >>> 24, (mix >> 16) & 0xff, (mix >> 8) & 0xff, mix & 0xff);
            } else {
              high = Math.floor(mix / 0x100000000);
              low = mix & 0xffffffff;
              rv.push(0xcf, (high >> 24) & 0xff, (high >> 16) & 0xff, (high >> 8) & 0xff, high & 0xff, (low >> 24) & 0xff, (low >> 16) & 0xff, (low >> 8) & 0xff, low & 0xff);
            }
          }
        } else { // double
          // THX!! @edvakf
          // http://javascript.g.hatena.ne.jp/edvakf/20101128/1291000731
          sign = mix < 0;
          sign && (mix *= -1);

          // add offset 1023 to ensure positive
          // 0.6931471805599453 = Math.LN2;
          exp = ((Math.log(mix) / 0.6931471805599453) + 1023) | 0;

          // shift 52 - (exp - 1023) bits to make integer part exactly 53 bits,
          // then throw away trash less than decimal point
          frac = mix * Math.pow(2, 52 + 1023 - exp);

          //  S+-Exp(11)--++-----------------Fraction(52bits)-----------------------+
          //  ||          ||                                                        |
          //  v+----------++--------------------------------------------------------+
          //  00000000|00000000|00000000|00000000|00000000|00000000|00000000|00000000
          //  6      5    55  4        4        3        2        1        8        0
          //  3      6    21  8        0        2        4        6
          //
          //  +----------high(32bits)-----------+ +----------low(32bits)------------+
          //  |                                 | |                                 |
          //  +---------------------------------+ +---------------------------------+
          //  3      2    21  1        8        0
          //  1      4    09  6
          low = frac & 0xffffffff;
          sign && (exp |= 0x800);
          high = ((frac / 0x100000000) & 0xfffff) | (exp << 20);

          rv.push(0xcb, (high >> 24) & 0xff, (high >> 16) & 0xff, (high >> 8) & 0xff, high & 0xff, (low >> 24) & 0xff, (low >> 16) & 0xff, (low >> 8) & 0xff, low & 0xff);
        }
        break;
      case "string":
        // http://d.hatena.ne.jp/uupaa/20101128
        iz = mix.length;
        pos = rv.length; // keep rewrite position
        rv.push(0); // placeholder
        // utf8.encode
        for (i = 0; i < iz; ++i) {
          c = mix.charCodeAt(i);
          if (c < 0x80) { // ASCII(0x00 ~ 0x7f)
            rv.push(c & 0x7f);
          } else if (c < 0x0800) {
            rv.push(((c >>> 6) & 0x1f) | 0xc0, (c & 0x3f) | 0x80);
          } else if (c < 0x10000) {
            rv.push(((c >>> 12) & 0x0f) | 0xe0, ((c >>> 6) & 0x3f) | 0x80, (c & 0x3f) | 0x80);
          }
        }
        size = rv.length - pos - 1;

        if (size < 32) {
          rv[pos] = 0xa0 + size; // rewrite
        } else if (size < 0x10000) { // 16
          rv.splice(pos, 1, 0xda, size >> 8, size & 0xff);
        } else if (size < 0x100000000) { // 32
          rv.splice(pos, 1, 0xdb, size >>> 24, (size >> 16) & 0xff, (size >> 8) & 0xff, size & 0xff);
        }
        break;
      default:
        // array or hash
        if (++depth >= this.MAX_DEPTH) {
          this._error = 1; // CYCLIC_REFERENCE_ERROR
          return rv = []; // clear
        }
        if (this._isArray(mix)) {
          size = mix.length;
          if (size < 16) {
            rv.push(0x90 + size);
          } else if (size < 0x10000) { // 16
            rv.push(0xdc, size >> 8, size & 0xff);
          } else if (size < 0x100000000) { // 32
            rv.push(0xdd, size >>> 24, (size >> 16) & 0xff, (size >> 8) & 0xff, size & 0xff);
          }
          for (i = 0; i < size; ++i) {
            this.encode(rv, mix[i], depth);
          }
        } else { // hash
          // http://d.hatena.ne.jp/uupaa/20101129
          pos = rv.length; // keep rewrite position
          rv.push(0); // placeholder
          size = 0;
          for (i in mix) {
            ++size;
            this.encode(rv, i, depth);
            this.encode(rv, mix[i], depth);
          }
          if (size < 16) {
            rv[pos] = 0x80 + size; // rewrite
          } else if (size < 0x10000) { // 16
            rv.splice(pos, 1, 0xde, size >> 8, size & 0xff);
          } else if (size < 0x100000000) { // 32
            rv.splice(pos, 1, 0xdf, size >>> 24, (size >> 16) & 0xff, (size >> 8) & 0xff, size & 0xff);
          }
        }
      }
    }
    return rv;
};


uupaa.MsgPack.prototype.decode = function(){
    var size, i, iz, c, num = 0,
        sign, exp, frac, ary, hash, buf = this._buf,
        type = buf[++this._idx];

    if (type >= 0xe0) { // Negative FixNum (111x xxxx) (-32 ~ -1)
      return type - 0x100;
    }
    if (type < 0xc0) {
      if (type < 0x80) { // Positive FixNum (0xxx xxxx) (0 ~ 127)
        return type;
      }
      if (type < 0x90) { // FixMap (1000 xxxx)
        num = type - 0x80;
        type = 0x80;
      } else if (type < 0xa0) { // FixArray (1001 xxxx)
        num = type - 0x90;
        type = 0x90;
      } else { // if (type < 0xc0) {   // FixRaw (101x xxxx)
        num = type - 0xa0;
        type = 0xa0;
      }
    }
    switch (type) {
    case 0xc0:
      return null;
    case 0xc2:
      return false;
    case 0xc3:
      return true;
    case 0xca:
      // float
      num = buf[++this._idx] * 0x1000000 + (buf[++this._idx] << 16) + (buf[++this._idx] << 8) + buf[++this._idx];
      sign = num & 0x80000000; //  1bit
      exp = (num >> 23) & 0xff; //  8bits
      frac = num & 0x7fffff; // 23bits
      if (!num || num === 0x80000000) { // 0.0 or -0.0
        return 0;
      }
      if (exp === 0xff) { // NaN or Infinity
        return frac ? NaN : Infinity;
      }
      return (sign ? -1 : 1) * (frac | 0x800000) * Math.pow(2, exp - 127 - 23); // 127: bias
    case 0xcb:
      // double
      num = buf[++this._idx] * 0x1000000 + (buf[++this._idx] << 16) + (buf[++this._idx] << 8) + buf[++this._idx];
      sign = num & 0x80000000; //  1bit
      exp = (num >> 20) & 0x7ff; // 11bits
      frac = num & 0xfffff; // 52bits - 32bits (high word)
      if (!num || num === 0x80000000) { // 0.0 or -0.0
        this._idx += 4;
        return 0;
      }
      if (exp === 0x7ff) { // NaN or Infinity
        this._idx += 4;
        return frac ? NaN : Infinity;
      }
      num = buf[++this._idx] * 0x1000000 + (buf[++this._idx] << 16) + (buf[++this._idx] << 8) + buf[++this._idx];
      return (sign ? -1 : 1) * ((frac | 0x100000) * Math.pow(2, exp - 1023 - 20) // 1023: bias
      + num * Math.pow(2, exp - 1023 - 52));
      // 0xcf: uint64, 0xce: uint32, 0xcd: uint16
    case 0xcf:
      num = buf[++this._idx] * 0x1000000 + (buf[++this._idx] << 16) + (buf[++this._idx] << 8) + buf[++this._idx];
      return num * 0x100000000 + buf[++this._idx] * 0x1000000 + (buf[++this._idx] << 16) + (buf[++this._idx] << 8) + buf[++this._idx];
    case 0xce:
      num += buf[++this._idx] * 0x1000000 + (buf[++this._idx] << 16);
    case 0xcd:
      num += buf[++this._idx] << 8;
    case 0xcc:
      return num + buf[++this._idx];
      // 0xd3: int64, 0xd2: int32, 0xd1: int16, 0xd0: int8
    case 0xd3:
      num = buf[++this._idx];
      if (num & 0x80) { // sign -> avoid overflow
        return ((num ^ 0xff) * 0x100000000000000 + (buf[++this._idx] ^ 0xff) * 0x1000000000000 + (buf[++this._idx] ^ 0xff) * 0x10000000000 + (buf[++this._idx] ^ 0xff) * 0x100000000 + (buf[++this._idx] ^ 0xff) * 0x1000000 + (buf[++this._idx] ^ 0xff) * 0x10000 + (buf[++this._idx] ^ 0xff) * 0x100 + (buf[++this._idx] ^ 0xff) + 1) * -1;
      }
      return num * 0x100000000000000 + buf[++this._idx] * 0x1000000000000 + buf[++this._idx] * 0x10000000000 + buf[++this._idx] * 0x100000000 + buf[++this._idx] * 0x1000000 + buf[++this._idx] * 0x10000 + buf[++this._idx] * 0x100 + buf[++this._idx];
    case 0xd2:
      num = buf[++this._idx] * 0x1000000 + (buf[++this._idx] << 16) + (buf[++this._idx] << 8) + buf[++this._idx];
      return num < 0x80000000 ? num : num - 0x100000000; // 0x80000000 * 2
    case 0xd1:
      num = (buf[++this._idx] << 8) + buf[++this._idx];
      return num < 0x8000 ? num : num - 0x10000; // 0x8000 * 2
    case 0xd0:
      num = buf[++this._idx];
      return num < 0x80 ? num : num - 0x100; // 0x80 * 2
      // 0xdb: raw32, 0xda: raw16, 0xa0: raw ( string )
    case 0xdb:
      num += buf[++this._idx] * 0x1000000 + (buf[++this._idx] << 16);
    case 0xda:
      num += (buf[++this._idx] << 8) + buf[++this._idx];
    case 0xa0:
      // utf8.decode
      for (ary = [], i = this._idx, iz = i + num; i < iz;) {
        c = buf[++i]; // lead byte
        ary.push(c < 0x80 ? c : // ASCII(0x00 ~ 0x7f)
        c < 0xe0 ? ((c & 0x1f) << 6 | (buf[++i] & 0x3f)) : ((c & 0x0f) << 12 | (buf[++i] & 0x3f) << 6 | (buf[++i] & 0x3f)));
      }
      this._idx = i;
      return ary.length < 10240 ? this._toString.apply(null, ary) : this.byteArrayToByteString(ary);
      // 0xdf: map32, 0xde: map16, 0x80: map
    case 0xdf:
      num += buf[++this._idx] * 0x1000000 + (buf[++this._idx] << 16);
    case 0xde:
      num += (buf[++this._idx] << 8) + buf[++this._idx];
    case 0x80:
      hash = {};
      while (num--) {
        // make key/value pair
        size = buf[++this._idx] - 0xa0;

        for (ary = [], i = this._idx, iz = i + size; i < iz;) {
          c = buf[++i]; // lead byte
          ary.push(c < 0x80 ? c : // ASCII(0x00 ~ 0x7f)
          c < 0xe0 ? ((c & 0x1f) << 6 | (buf[++i] & 0x3f)) : ((c & 0x0f) << 12 | (buf[++i] & 0x3f) << 6 | (buf[++i] & 0x3f)));
        }
        this._idx = i;
        hash[this._toString.apply(null, ary)] = this.decode();
      }
      return hash;
      // 0xdd: array32, 0xdc: array16, 0x90: array
    case 0xdd:
      num += buf[++this._idx] * 0x1000000 + (buf[++this._idx] << 16);
    case 0xdc:
      num += (buf[++this._idx] << 8) + buf[++this._idx];
    case 0x90:
      ary = [];
      while (num--) {
        ary.push(this.decode());
      }
      return ary;
    }
    return null;
};


/**
 * @param {!Array.<!*>} byteArray
 * @return {!string}
 */
uupaa.MsgPack.prototype.byteArrayToByteString = function(byteArray){
    try {
      return this._toString.apply(this, byteArray); // toString
    } catch (err) {; // avoid "Maximum call stack size exceeded"
    }
    var rv = [],
        i = 0,
        iz = byteArray.length,
        num2bin = this._num2bin;

    for (; i < iz; ++i) {
      rv[i] = num2bin[byteArray[i]];
    }
    return rv.join("");
};


/**
 * @param {!*} data
 */
uupaa.MsgPack.prototype.toByteArray = function(data){
    var rv = [],
        bin2num = this._bin2num,
        remain, ary = data.split(""),
        i = -1,
        iz;

    iz = ary.length;
    remain = iz % 8;

    while (remain--) {
      ++i;
      rv[i] = bin2num[ary[i]];
    }
    remain = iz >> 3;
    while (remain--) {
      rv.push(bin2num[ary[++i]], bin2num[ary[++i]], bin2num[ary[++i]], bin2num[ary[++i]], bin2num[ary[++i]], bin2num[ary[++i]], bin2num[ary[++i]], bin2num[ary[++i]]);
    }
    return rv;
};


/**
 * @param {*} data
 * @return {!string}
 */
uupaa.MsgPack.prototype.base64encode = function(data){
    var rv = [],
        c = 0,
        i = -1,
        iz = data.length,
        pad = [0, 2, 1][data.length % 3],
        num2bin = this._num2bin,
        num2b64 = this._num2b64;

    --iz;
    while (i < iz) {
      c = (data[++i] << 16) | (data[++i] << 8) | (data[++i]); // 24bit
      rv.push(num2b64[(c >> 18) & 0x3f], num2b64[(c >> 12) & 0x3f], num2b64[(c >> 6) & 0x3f], num2b64[c & 0x3f]);
    }
    pad > 1 && (rv[rv.length - 2] = "=");
    pad > 0 && (rv[rv.length - 1] = "=");
    return rv.join("");
};
