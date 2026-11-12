/**
 * 学习教练（Learning Coach）— Client half.
 *
 * Renders a dedicated "学习中心 / Study Center" main panel, a sidebar entry, and
 * a compact review pill below the composer. All data comes from this bundle's
 * own Config snapshot through `remote.settings.describe()`; grades are written
 * back with `remote.settings.update()`, the same volatile field the Host tool
 * uses, so both surfaces always share one deck.
 *
 * Plain JavaScript only: no JSX, no module imports beyond `react`.
 */
window.__ModuleLoader__.load({
  id: '@local/dsh-study-coach',
  factory(require) {
    /* QR Code Generator for JavaScript — Copyright (c) 2009 Kazuhiko Arase, MIT License. Vendored for QR login rendering. */
//---------------------------------------------------------------------
//
// QR Code Generator for JavaScript
//
// Copyright (c) 2009 Kazuhiko Arase
//
// URL: http://www.d-project.com/
//
// Licensed under the MIT license:
//  http://www.opensource.org/licenses/mit-license.php
//
// The word 'QR Code' is registered trademark of
// DENSO WAVE INCORPORATED
//  http://www.denso-wave.com/qrcode/faqpatent-e.html
//
//---------------------------------------------------------------------

var qrcode = function() {

  //---------------------------------------------------------------------
  // qrcode
  //---------------------------------------------------------------------

  /**
   * qrcode
   * @param typeNumber 1 to 40
   * @param errorCorrectionLevel 'L','M','Q','H'
   */
  var qrcode = function(typeNumber, errorCorrectionLevel) {

    var PAD0 = 0xEC;
    var PAD1 = 0x11;

    var _typeNumber = typeNumber;
    var _errorCorrectionLevel = QRErrorCorrectionLevel[errorCorrectionLevel];
    var _modules = null;
    var _moduleCount = 0;
    var _dataCache = null;
    var _dataList = [];

    var _this = {};

    var makeImpl = function(test, maskPattern) {

      _moduleCount = _typeNumber * 4 + 17;
      _modules = function(moduleCount) {
        var modules = new Array(moduleCount);
        for (var row = 0; row < moduleCount; row += 1) {
          modules[row] = new Array(moduleCount);
          for (var col = 0; col < moduleCount; col += 1) {
            modules[row][col] = null;
          }
        }
        return modules;
      }(_moduleCount);

      setupPositionProbePattern(0, 0);
      setupPositionProbePattern(_moduleCount - 7, 0);
      setupPositionProbePattern(0, _moduleCount - 7);
      setupPositionAdjustPattern();
      setupTimingPattern();
      setupTypeInfo(test, maskPattern);

      if (_typeNumber >= 7) {
        setupTypeNumber(test);
      }

      if (_dataCache == null) {
        _dataCache = createData(_typeNumber, _errorCorrectionLevel, _dataList);
      }

      mapData(_dataCache, maskPattern);
    };

    var setupPositionProbePattern = function(row, col) {

      for (var r = -1; r <= 7; r += 1) {

        if (row + r <= -1 || _moduleCount <= row + r) continue;

        for (var c = -1; c <= 7; c += 1) {

          if (col + c <= -1 || _moduleCount <= col + c) continue;

          if ( (0 <= r && r <= 6 && (c == 0 || c == 6) )
              || (0 <= c && c <= 6 && (r == 0 || r == 6) )
              || (2 <= r && r <= 4 && 2 <= c && c <= 4) ) {
            _modules[row + r][col + c] = true;
          } else {
            _modules[row + r][col + c] = false;
          }
        }
      }
    };

    var getBestMaskPattern = function() {

      var minLostPoint = 0;
      var pattern = 0;

      for (var i = 0; i < 8; i += 1) {

        makeImpl(true, i);

        var lostPoint = QRUtil.getLostPoint(_this);

        if (i == 0 || minLostPoint > lostPoint) {
          minLostPoint = lostPoint;
          pattern = i;
        }
      }

      return pattern;
    };

    var setupTimingPattern = function() {

      for (var r = 8; r < _moduleCount - 8; r += 1) {
        if (_modules[r][6] != null) {
          continue;
        }
        _modules[r][6] = (r % 2 == 0);
      }

      for (var c = 8; c < _moduleCount - 8; c += 1) {
        if (_modules[6][c] != null) {
          continue;
        }
        _modules[6][c] = (c % 2 == 0);
      }
    };

    var setupPositionAdjustPattern = function() {

      var pos = QRUtil.getPatternPosition(_typeNumber);

      for (var i = 0; i < pos.length; i += 1) {

        for (var j = 0; j < pos.length; j += 1) {

          var row = pos[i];
          var col = pos[j];

          if (_modules[row][col] != null) {
            continue;
          }

          for (var r = -2; r <= 2; r += 1) {

            for (var c = -2; c <= 2; c += 1) {

              if (r == -2 || r == 2 || c == -2 || c == 2
                  || (r == 0 && c == 0) ) {
                _modules[row + r][col + c] = true;
              } else {
                _modules[row + r][col + c] = false;
              }
            }
          }
        }
      }
    };

    var setupTypeNumber = function(test) {

      var bits = QRUtil.getBCHTypeNumber(_typeNumber);

      for (var i = 0; i < 18; i += 1) {
        var mod = (!test && ( (bits >> i) & 1) == 1);
        _modules[Math.floor(i / 3)][i % 3 + _moduleCount - 8 - 3] = mod;
      }

      for (var i = 0; i < 18; i += 1) {
        var mod = (!test && ( (bits >> i) & 1) == 1);
        _modules[i % 3 + _moduleCount - 8 - 3][Math.floor(i / 3)] = mod;
      }
    };

    var setupTypeInfo = function(test, maskPattern) {

      var data = (_errorCorrectionLevel << 3) | maskPattern;
      var bits = QRUtil.getBCHTypeInfo(data);

      // vertical
      for (var i = 0; i < 15; i += 1) {

        var mod = (!test && ( (bits >> i) & 1) == 1);

        if (i < 6) {
          _modules[i][8] = mod;
        } else if (i < 8) {
          _modules[i + 1][8] = mod;
        } else {
          _modules[_moduleCount - 15 + i][8] = mod;
        }
      }

      // horizontal
      for (var i = 0; i < 15; i += 1) {

        var mod = (!test && ( (bits >> i) & 1) == 1);

        if (i < 8) {
          _modules[8][_moduleCount - i - 1] = mod;
        } else if (i < 9) {
          _modules[8][15 - i - 1 + 1] = mod;
        } else {
          _modules[8][15 - i - 1] = mod;
        }
      }

      // fixed module
      _modules[_moduleCount - 8][8] = (!test);
    };

    var mapData = function(data, maskPattern) {

      var inc = -1;
      var row = _moduleCount - 1;
      var bitIndex = 7;
      var byteIndex = 0;
      var maskFunc = QRUtil.getMaskFunction(maskPattern);

      for (var col = _moduleCount - 1; col > 0; col -= 2) {

        if (col == 6) col -= 1;

        while (true) {

          for (var c = 0; c < 2; c += 1) {

            if (_modules[row][col - c] == null) {

              var dark = false;

              if (byteIndex < data.length) {
                dark = ( ( (data[byteIndex] >>> bitIndex) & 1) == 1);
              }

              var mask = maskFunc(row, col - c);

              if (mask) {
                dark = !dark;
              }

              _modules[row][col - c] = dark;
              bitIndex -= 1;

              if (bitIndex == -1) {
                byteIndex += 1;
                bitIndex = 7;
              }
            }
          }

          row += inc;

          if (row < 0 || _moduleCount <= row) {
            row -= inc;
            inc = -inc;
            break;
          }
        }
      }
    };

    var createBytes = function(buffer, rsBlocks) {

      var offset = 0;

      var maxDcCount = 0;
      var maxEcCount = 0;

      var dcdata = new Array(rsBlocks.length);
      var ecdata = new Array(rsBlocks.length);

      for (var r = 0; r < rsBlocks.length; r += 1) {

        var dcCount = rsBlocks[r].dataCount;
        var ecCount = rsBlocks[r].totalCount - dcCount;

        maxDcCount = Math.max(maxDcCount, dcCount);
        maxEcCount = Math.max(maxEcCount, ecCount);

        dcdata[r] = new Array(dcCount);

        for (var i = 0; i < dcdata[r].length; i += 1) {
          dcdata[r][i] = 0xff & buffer.getBuffer()[i + offset];
        }
        offset += dcCount;

        var rsPoly = QRUtil.getErrorCorrectPolynomial(ecCount);
        var rawPoly = qrPolynomial(dcdata[r], rsPoly.getLength() - 1);

        var modPoly = rawPoly.mod(rsPoly);
        ecdata[r] = new Array(rsPoly.getLength() - 1);
        for (var i = 0; i < ecdata[r].length; i += 1) {
          var modIndex = i + modPoly.getLength() - ecdata[r].length;
          ecdata[r][i] = (modIndex >= 0)? modPoly.getAt(modIndex) : 0;
        }
      }

      var totalCodeCount = 0;
      for (var i = 0; i < rsBlocks.length; i += 1) {
        totalCodeCount += rsBlocks[i].totalCount;
      }

      var data = new Array(totalCodeCount);
      var index = 0;

      for (var i = 0; i < maxDcCount; i += 1) {
        for (var r = 0; r < rsBlocks.length; r += 1) {
          if (i < dcdata[r].length) {
            data[index] = dcdata[r][i];
            index += 1;
          }
        }
      }

      for (var i = 0; i < maxEcCount; i += 1) {
        for (var r = 0; r < rsBlocks.length; r += 1) {
          if (i < ecdata[r].length) {
            data[index] = ecdata[r][i];
            index += 1;
          }
        }
      }

      return data;
    };

    var createData = function(typeNumber, errorCorrectionLevel, dataList) {

      var rsBlocks = QRRSBlock.getRSBlocks(typeNumber, errorCorrectionLevel);

      var buffer = qrBitBuffer();

      for (var i = 0; i < dataList.length; i += 1) {
        var data = dataList[i];
        buffer.put(data.getMode(), 4);
        buffer.put(data.getLength(), QRUtil.getLengthInBits(data.getMode(), typeNumber) );
        data.write(buffer);
      }

      // calc num max data.
      var totalDataCount = 0;
      for (var i = 0; i < rsBlocks.length; i += 1) {
        totalDataCount += rsBlocks[i].dataCount;
      }

      if (buffer.getLengthInBits() > totalDataCount * 8) {
        throw 'code length overflow. ('
          + buffer.getLengthInBits()
          + '>'
          + totalDataCount * 8
          + ')';
      }

      // end code
      if (buffer.getLengthInBits() + 4 <= totalDataCount * 8) {
        buffer.put(0, 4);
      }

      // padding
      while (buffer.getLengthInBits() % 8 != 0) {
        buffer.putBit(false);
      }

      // padding
      while (true) {

        if (buffer.getLengthInBits() >= totalDataCount * 8) {
          break;
        }
        buffer.put(PAD0, 8);

        if (buffer.getLengthInBits() >= totalDataCount * 8) {
          break;
        }
        buffer.put(PAD1, 8);
      }

      return createBytes(buffer, rsBlocks);
    };

    _this.addData = function(data, mode) {

      mode = mode || 'Byte';

      var newData = null;

      switch(mode) {
      case 'Numeric' :
        newData = qrNumber(data);
        break;
      case 'Alphanumeric' :
        newData = qrAlphaNum(data);
        break;
      case 'Byte' :
        newData = qr8BitByte(data);
        break;
      case 'Kanji' :
        newData = qrKanji(data);
        break;
      default :
        throw 'mode:' + mode;
      }

      _dataList.push(newData);
      _dataCache = null;
    };

    _this.isDark = function(row, col) {
      if (row < 0 || _moduleCount <= row || col < 0 || _moduleCount <= col) {
        throw row + ',' + col;
      }
      return _modules[row][col];
    };

    _this.getModuleCount = function() {
      return _moduleCount;
    };

    _this.make = function() {
      if (_typeNumber < 1) {
        var typeNumber = 1;

        for (; typeNumber < 40; typeNumber++) {
          var rsBlocks = QRRSBlock.getRSBlocks(typeNumber, _errorCorrectionLevel);
          var buffer = qrBitBuffer();

          for (var i = 0; i < _dataList.length; i++) {
            var data = _dataList[i];
            buffer.put(data.getMode(), 4);
            buffer.put(data.getLength(), QRUtil.getLengthInBits(data.getMode(), typeNumber) );
            data.write(buffer);
          }

          var totalDataCount = 0;
          for (var i = 0; i < rsBlocks.length; i++) {
            totalDataCount += rsBlocks[i].dataCount;
          }

          if (buffer.getLengthInBits() <= totalDataCount * 8) {
            break;
          }
        }

        _typeNumber = typeNumber;
      }

      makeImpl(false, getBestMaskPattern() );
    };

    _this.createTableTag = function(cellSize, margin) {

      cellSize = cellSize || 2;
      margin = (typeof margin == 'undefined')? cellSize * 4 : margin;

      var qrHtml = '';

      qrHtml += '<table style="';
      qrHtml += ' border-width: 0px; border-style: none;';
      qrHtml += ' border-collapse: collapse;';
      qrHtml += ' padding: 0px; margin: ' + margin + 'px;';
      qrHtml += '">';
      qrHtml += '<tbody>';

      for (var r = 0; r < _this.getModuleCount(); r += 1) {

        qrHtml += '<tr>';

        for (var c = 0; c < _this.getModuleCount(); c += 1) {
          qrHtml += '<td style="';
          qrHtml += ' border-width: 0px; border-style: none;';
          qrHtml += ' border-collapse: collapse;';
          qrHtml += ' padding: 0px; margin: 0px;';
          qrHtml += ' width: ' + cellSize + 'px;';
          qrHtml += ' height: ' + cellSize + 'px;';
          qrHtml += ' background-color: ';
          qrHtml += _this.isDark(r, c)? '#000000' : '#ffffff';
          qrHtml += ';';
          qrHtml += '"/>';
        }

        qrHtml += '</tr>';
      }

      qrHtml += '</tbody>';
      qrHtml += '</table>';

      return qrHtml;
    };

    _this.createSvgTag = function(cellSize, margin, alt, title) {

      var opts = {};
      if (typeof arguments[0] == 'object') {
        // Called by options.
        opts = arguments[0];
        // overwrite cellSize and margin.
        cellSize = opts.cellSize;
        margin = opts.margin;
        alt = opts.alt;
        title = opts.title;
      }

      cellSize = cellSize || 2;
      margin = (typeof margin == 'undefined')? cellSize * 4 : margin;

      // Compose alt property surrogate
      alt = (typeof alt === 'string') ? {text: alt} : alt || {};
      alt.text = alt.text || null;
      alt.id = (alt.text) ? alt.id || 'qrcode-description' : null;

      // Compose title property surrogate
      title = (typeof title === 'string') ? {text: title} : title || {};
      title.text = title.text || null;
      title.id = (title.text) ? title.id || 'qrcode-title' : null;

      var size = _this.getModuleCount() * cellSize + margin * 2;
      var c, mc, r, mr, qrSvg='', rect;

      rect = 'l' + cellSize + ',0 0,' + cellSize +
        ' -' + cellSize + ',0 0,-' + cellSize + 'z ';

      qrSvg += '<svg version="1.1" xmlns="http://www.w3.org/2000/svg"';
      qrSvg += !opts.scalable ? ' width="' + size + 'px" height="' + size + 'px"' : '';
      qrSvg += ' viewBox="0 0 ' + size + ' ' + size + '" ';
      qrSvg += ' preserveAspectRatio="xMinYMin meet"';
      qrSvg += (title.text || alt.text) ? ' role="img" aria-labelledby="' +
          escapeXml([title.id, alt.id].join(' ').trim() ) + '"' : '';
      qrSvg += '>';
      qrSvg += (title.text) ? '<title id="' + escapeXml(title.id) + '">' +
          escapeXml(title.text) + '</title>' : '';
      qrSvg += (alt.text) ? '<description id="' + escapeXml(alt.id) + '">' +
          escapeXml(alt.text) + '</description>' : '';
      qrSvg += '<rect width="100%" height="100%" fill="white" cx="0" cy="0"/>';
      qrSvg += '<path d="';

      for (r = 0; r < _this.getModuleCount(); r += 1) {
        mr = r * cellSize + margin;
        for (c = 0; c < _this.getModuleCount(); c += 1) {
          if (_this.isDark(r, c) ) {
            mc = c*cellSize+margin;
            qrSvg += 'M' + mc + ',' + mr + rect;
          }
        }
      }

      qrSvg += '" stroke="transparent" fill="black"/>';
      qrSvg += '</svg>';

      return qrSvg;
    };

    _this.createDataURL = function(cellSize, margin) {

      cellSize = cellSize || 2;
      margin = (typeof margin == 'undefined')? cellSize * 4 : margin;

      var size = _this.getModuleCount() * cellSize + margin * 2;
      var min = margin;
      var max = size - margin;

      return createDataURL(size, size, function(x, y) {
        if (min <= x && x < max && min <= y && y < max) {
          var c = Math.floor( (x - min) / cellSize);
          var r = Math.floor( (y - min) / cellSize);
          return _this.isDark(r, c)? 0 : 1;
        } else {
          return 1;
        }
      } );
    };

    _this.createImgTag = function(cellSize, margin, alt) {

      cellSize = cellSize || 2;
      margin = (typeof margin == 'undefined')? cellSize * 4 : margin;

      var size = _this.getModuleCount() * cellSize + margin * 2;

      var img = '';
      img += '<img';
      img += '\u0020src="';
      img += _this.createDataURL(cellSize, margin);
      img += '"';
      img += '\u0020width="';
      img += size;
      img += '"';
      img += '\u0020height="';
      img += size;
      img += '"';
      if (alt) {
        img += '\u0020alt="';
        img += escapeXml(alt);
        img += '"';
      }
      img += '/>';

      return img;
    };

    var escapeXml = function(s) {
      var escaped = '';
      for (var i = 0; i < s.length; i += 1) {
        var c = s.charAt(i);
        switch(c) {
        case '<': escaped += '&lt;'; break;
        case '>': escaped += '&gt;'; break;
        case '&': escaped += '&amp;'; break;
        case '"': escaped += '&quot;'; break;
        default : escaped += c; break;
        }
      }
      return escaped;
    };

    var _createHalfASCII = function(margin) {
      var cellSize = 1;
      margin = (typeof margin == 'undefined')? cellSize * 2 : margin;

      var size = _this.getModuleCount() * cellSize + margin * 2;
      var min = margin;
      var max = size - margin;

      var y, x, r1, r2, p;

      var blocks = {
        '██': '█',
        '█ ': '▀',
        ' █': '▄',
        '  ': ' '
      };

      var blocksLastLineNoMargin = {
        '██': '▀',
        '█ ': '▀',
        ' █': ' ',
        '  ': ' '
      };

      var ascii = '';
      for (y = 0; y < size; y += 2) {
        r1 = Math.floor((y - min) / cellSize);
        r2 = Math.floor((y + 1 - min) / cellSize);
        for (x = 0; x < size; x += 1) {
          p = '█';

          if (min <= x && x < max && min <= y && y < max && _this.isDark(r1, Math.floor((x - min) / cellSize))) {
            p = ' ';
          }

          if (min <= x && x < max && min <= y+1 && y+1 < max && _this.isDark(r2, Math.floor((x - min) / cellSize))) {
            p += ' ';
          }
          else {
            p += '█';
          }

          // Output 2 characters per pixel, to create full square. 1 character per pixels gives only half width of square.
          ascii += (margin < 1 && y+1 >= max) ? blocksLastLineNoMargin[p] : blocks[p];
        }

        ascii += '\n';
      }

      if (size % 2 && margin > 0) {
        return ascii.substring(0, ascii.length - size - 1) + Array(size+1).join('▀');
      }

      return ascii.substring(0, ascii.length-1);
    };

    _this.createASCII = function(cellSize, margin) {
      cellSize = cellSize || 1;

      if (cellSize < 2) {
        return _createHalfASCII(margin);
      }

      cellSize -= 1;
      margin = (typeof margin == 'undefined')? cellSize * 2 : margin;

      var size = _this.getModuleCount() * cellSize + margin * 2;
      var min = margin;
      var max = size - margin;

      var y, x, r, p;

      var white = Array(cellSize+1).join('██');
      var black = Array(cellSize+1).join('  ');

      var ascii = '';
      var line = '';
      for (y = 0; y < size; y += 1) {
        r = Math.floor( (y - min) / cellSize);
        line = '';
        for (x = 0; x < size; x += 1) {
          p = 1;

          if (min <= x && x < max && min <= y && y < max && _this.isDark(r, Math.floor((x - min) / cellSize))) {
            p = 0;
          }

          // Output 2 characters per pixel, to create full square. 1 character per pixels gives only half width of square.
          line += p ? white : black;
        }

        for (r = 0; r < cellSize; r += 1) {
          ascii += line + '\n';
        }
      }

      return ascii.substring(0, ascii.length-1);
    };

    _this.renderTo2dContext = function(context, cellSize) {
      cellSize = cellSize || 2;
      var length = _this.getModuleCount();
      for (var row = 0; row < length; row++) {
        for (var col = 0; col < length; col++) {
          context.fillStyle = _this.isDark(row, col) ? 'black' : 'white';
          context.fillRect(row * cellSize, col * cellSize, cellSize, cellSize);
        }
      }
    }

    return _this;
  };

  //---------------------------------------------------------------------
  // qrcode.stringToBytes
  //---------------------------------------------------------------------

  qrcode.stringToBytesFuncs = {
    'default' : function(s) {
      var bytes = [];
      for (var i = 0; i < s.length; i += 1) {
        var c = s.charCodeAt(i);
        bytes.push(c & 0xff);
      }
      return bytes;
    }
  };

  qrcode.stringToBytes = qrcode.stringToBytesFuncs['default'];

  //---------------------------------------------------------------------
  // qrcode.createStringToBytes
  //---------------------------------------------------------------------

  /**
   * @param unicodeData base64 string of byte array.
   * [16bit Unicode],[16bit Bytes], ...
   * @param numChars
   */
  qrcode.createStringToBytes = function(unicodeData, numChars) {

    // create conversion map.

    var unicodeMap = function() {

      var bin = base64DecodeInputStream(unicodeData);
      var read = function() {
        var b = bin.read();
        if (b == -1) throw 'eof';
        return b;
      };

      var count = 0;
      var unicodeMap = {};
      while (true) {
        var b0 = bin.read();
        if (b0 == -1) break;
        var b1 = read();
        var b2 = read();
        var b3 = read();
        var k = String.fromCharCode( (b0 << 8) | b1);
        var v = (b2 << 8) | b3;
        unicodeMap[k] = v;
        count += 1;
      }
      if (count != numChars) {
        throw count + ' != ' + numChars;
      }

      return unicodeMap;
    }();

    var unknownChar = '?'.charCodeAt(0);

    return function(s) {
      var bytes = [];
      for (var i = 0; i < s.length; i += 1) {
        var c = s.charCodeAt(i);
        if (c < 128) {
          bytes.push(c);
        } else {
          var b = unicodeMap[s.charAt(i)];
          if (typeof b == 'number') {
            if ( (b & 0xff) == b) {
              // 1byte
              bytes.push(b);
            } else {
              // 2bytes
              bytes.push(b >>> 8);
              bytes.push(b & 0xff);
            }
          } else {
            bytes.push(unknownChar);
          }
        }
      }
      return bytes;
    };
  };

  //---------------------------------------------------------------------
  // QRMode
  //---------------------------------------------------------------------

  var QRMode = {
    MODE_NUMBER :    1 << 0,
    MODE_ALPHA_NUM : 1 << 1,
    MODE_8BIT_BYTE : 1 << 2,
    MODE_KANJI :     1 << 3
  };

  //---------------------------------------------------------------------
  // QRErrorCorrectionLevel
  //---------------------------------------------------------------------

  var QRErrorCorrectionLevel = {
    L : 1,
    M : 0,
    Q : 3,
    H : 2
  };

  //---------------------------------------------------------------------
  // QRMaskPattern
  //---------------------------------------------------------------------

  var QRMaskPattern = {
    PATTERN000 : 0,
    PATTERN001 : 1,
    PATTERN010 : 2,
    PATTERN011 : 3,
    PATTERN100 : 4,
    PATTERN101 : 5,
    PATTERN110 : 6,
    PATTERN111 : 7
  };

  //---------------------------------------------------------------------
  // QRUtil
  //---------------------------------------------------------------------

  var QRUtil = function() {

    var PATTERN_POSITION_TABLE = [
      [],
      [6, 18],
      [6, 22],
      [6, 26],
      [6, 30],
      [6, 34],
      [6, 22, 38],
      [6, 24, 42],
      [6, 26, 46],
      [6, 28, 50],
      [6, 30, 54],
      [6, 32, 58],
      [6, 34, 62],
      [6, 26, 46, 66],
      [6, 26, 48, 70],
      [6, 26, 50, 74],
      [6, 30, 54, 78],
      [6, 30, 56, 82],
      [6, 30, 58, 86],
      [6, 34, 62, 90],
      [6, 28, 50, 72, 94],
      [6, 26, 50, 74, 98],
      [6, 30, 54, 78, 102],
      [6, 28, 54, 80, 106],
      [6, 32, 58, 84, 110],
      [6, 30, 58, 86, 114],
      [6, 34, 62, 90, 118],
      [6, 26, 50, 74, 98, 122],
      [6, 30, 54, 78, 102, 126],
      [6, 26, 52, 78, 104, 130],
      [6, 30, 56, 82, 108, 134],
      [6, 34, 60, 86, 112, 138],
      [6, 30, 58, 86, 114, 142],
      [6, 34, 62, 90, 118, 146],
      [6, 30, 54, 78, 102, 126, 150],
      [6, 24, 50, 76, 102, 128, 154],
      [6, 28, 54, 80, 106, 132, 158],
      [6, 32, 58, 84, 110, 136, 162],
      [6, 26, 54, 82, 110, 138, 166],
      [6, 30, 58, 86, 114, 142, 170]
    ];
    var G15 = (1 << 10) | (1 << 8) | (1 << 5) | (1 << 4) | (1 << 2) | (1 << 1) | (1 << 0);
    var G18 = (1 << 12) | (1 << 11) | (1 << 10) | (1 << 9) | (1 << 8) | (1 << 5) | (1 << 2) | (1 << 0);
    var G15_MASK = (1 << 14) | (1 << 12) | (1 << 10) | (1 << 4) | (1 << 1);

    var _this = {};

    var getBCHDigit = function(data) {
      var digit = 0;
      while (data != 0) {
        digit += 1;
        data >>>= 1;
      }
      return digit;
    };

    _this.getBCHTypeInfo = function(data) {
      var d = data << 10;
      while (getBCHDigit(d) - getBCHDigit(G15) >= 0) {
        d ^= (G15 << (getBCHDigit(d) - getBCHDigit(G15) ) );
      }
      return ( (data << 10) | d) ^ G15_MASK;
    };

    _this.getBCHTypeNumber = function(data) {
      var d = data << 12;
      while (getBCHDigit(d) - getBCHDigit(G18) >= 0) {
        d ^= (G18 << (getBCHDigit(d) - getBCHDigit(G18) ) );
      }
      return (data << 12) | d;
    };

    _this.getPatternPosition = function(typeNumber) {
      return PATTERN_POSITION_TABLE[typeNumber - 1];
    };

    _this.getMaskFunction = function(maskPattern) {

      switch (maskPattern) {

      case QRMaskPattern.PATTERN000 :
        return function(i, j) { return (i + j) % 2 == 0; };
      case QRMaskPattern.PATTERN001 :
        return function(i, j) { return i % 2 == 0; };
      case QRMaskPattern.PATTERN010 :
        return function(i, j) { return j % 3 == 0; };
      case QRMaskPattern.PATTERN011 :
        return function(i, j) { return (i + j) % 3 == 0; };
      case QRMaskPattern.PATTERN100 :
        return function(i, j) { return (Math.floor(i / 2) + Math.floor(j / 3) ) % 2 == 0; };
      case QRMaskPattern.PATTERN101 :
        return function(i, j) { return (i * j) % 2 + (i * j) % 3 == 0; };
      case QRMaskPattern.PATTERN110 :
        return function(i, j) { return ( (i * j) % 2 + (i * j) % 3) % 2 == 0; };
      case QRMaskPattern.PATTERN111 :
        return function(i, j) { return ( (i * j) % 3 + (i + j) % 2) % 2 == 0; };

      default :
        throw 'bad maskPattern:' + maskPattern;
      }
    };

    _this.getErrorCorrectPolynomial = function(errorCorrectLength) {
      var a = qrPolynomial([1], 0);
      for (var i = 0; i < errorCorrectLength; i += 1) {
        a = a.multiply(qrPolynomial([1, QRMath.gexp(i)], 0) );
      }
      return a;
    };

    _this.getLengthInBits = function(mode, type) {

      if (1 <= type && type < 10) {

        // 1 - 9

        switch(mode) {
        case QRMode.MODE_NUMBER    : return 10;
        case QRMode.MODE_ALPHA_NUM : return 9;
        case QRMode.MODE_8BIT_BYTE : return 8;
        case QRMode.MODE_KANJI     : return 8;
        default :
          throw 'mode:' + mode;
        }

      } else if (type < 27) {

        // 10 - 26

        switch(mode) {
        case QRMode.MODE_NUMBER    : return 12;
        case QRMode.MODE_ALPHA_NUM : return 11;
        case QRMode.MODE_8BIT_BYTE : return 16;
        case QRMode.MODE_KANJI     : return 10;
        default :
          throw 'mode:' + mode;
        }

      } else if (type < 41) {

        // 27 - 40

        switch(mode) {
        case QRMode.MODE_NUMBER    : return 14;
        case QRMode.MODE_ALPHA_NUM : return 13;
        case QRMode.MODE_8BIT_BYTE : return 16;
        case QRMode.MODE_KANJI     : return 12;
        default :
          throw 'mode:' + mode;
        }

      } else {
        throw 'type:' + type;
      }
    };

    _this.getLostPoint = function(qrcode) {

      var moduleCount = qrcode.getModuleCount();

      var lostPoint = 0;

      // LEVEL1

      for (var row = 0; row < moduleCount; row += 1) {
        for (var col = 0; col < moduleCount; col += 1) {

          var sameCount = 0;
          var dark = qrcode.isDark(row, col);

          for (var r = -1; r <= 1; r += 1) {

            if (row + r < 0 || moduleCount <= row + r) {
              continue;
            }

            for (var c = -1; c <= 1; c += 1) {

              if (col + c < 0 || moduleCount <= col + c) {
                continue;
              }

              if (r == 0 && c == 0) {
                continue;
              }

              if (dark == qrcode.isDark(row + r, col + c) ) {
                sameCount += 1;
              }
            }
          }

          if (sameCount > 5) {
            lostPoint += (3 + sameCount - 5);
          }
        }
      };

      // LEVEL2

      for (var row = 0; row < moduleCount - 1; row += 1) {
        for (var col = 0; col < moduleCount - 1; col += 1) {
          var count = 0;
          if (qrcode.isDark(row, col) ) count += 1;
          if (qrcode.isDark(row + 1, col) ) count += 1;
          if (qrcode.isDark(row, col + 1) ) count += 1;
          if (qrcode.isDark(row + 1, col + 1) ) count += 1;
          if (count == 0 || count == 4) {
            lostPoint += 3;
          }
        }
      }

      // LEVEL3

      for (var row = 0; row < moduleCount; row += 1) {
        for (var col = 0; col < moduleCount - 6; col += 1) {
          if (qrcode.isDark(row, col)
              && !qrcode.isDark(row, col + 1)
              &&  qrcode.isDark(row, col + 2)
              &&  qrcode.isDark(row, col + 3)
              &&  qrcode.isDark(row, col + 4)
              && !qrcode.isDark(row, col + 5)
              &&  qrcode.isDark(row, col + 6) ) {
            lostPoint += 40;
          }
        }
      }

      for (var col = 0; col < moduleCount; col += 1) {
        for (var row = 0; row < moduleCount - 6; row += 1) {
          if (qrcode.isDark(row, col)
              && !qrcode.isDark(row + 1, col)
              &&  qrcode.isDark(row + 2, col)
              &&  qrcode.isDark(row + 3, col)
              &&  qrcode.isDark(row + 4, col)
              && !qrcode.isDark(row + 5, col)
              &&  qrcode.isDark(row + 6, col) ) {
            lostPoint += 40;
          }
        }
      }

      // LEVEL4

      var darkCount = 0;

      for (var col = 0; col < moduleCount; col += 1) {
        for (var row = 0; row < moduleCount; row += 1) {
          if (qrcode.isDark(row, col) ) {
            darkCount += 1;
          }
        }
      }

      var ratio = Math.abs(100 * darkCount / moduleCount / moduleCount - 50) / 5;
      lostPoint += ratio * 10;

      return lostPoint;
    };

    return _this;
  }();

  //---------------------------------------------------------------------
  // QRMath
  //---------------------------------------------------------------------

  var QRMath = function() {

    var EXP_TABLE = new Array(256);
    var LOG_TABLE = new Array(256);

    // initialize tables
    for (var i = 0; i < 8; i += 1) {
      EXP_TABLE[i] = 1 << i;
    }
    for (var i = 8; i < 256; i += 1) {
      EXP_TABLE[i] = EXP_TABLE[i - 4]
        ^ EXP_TABLE[i - 5]
        ^ EXP_TABLE[i - 6]
        ^ EXP_TABLE[i - 8];
    }
    for (var i = 0; i < 255; i += 1) {
      LOG_TABLE[EXP_TABLE[i] ] = i;
    }

    var _this = {};

    _this.glog = function(n) {

      if (n < 1) {
        throw 'glog(' + n + ')';
      }

      return LOG_TABLE[n];
    };

    _this.gexp = function(n) {

      while (n < 0) {
        n += 255;
      }

      while (n >= 256) {
        n -= 255;
      }

      return EXP_TABLE[n];
    };

    return _this;
  }();

  //---------------------------------------------------------------------
  // qrPolynomial
  //---------------------------------------------------------------------

  function qrPolynomial(num, shift) {

    if (typeof num.length == 'undefined') {
      throw num.length + '/' + shift;
    }

    var _num = function() {
      var offset = 0;
      while (offset < num.length && num[offset] == 0) {
        offset += 1;
      }
      var _num = new Array(num.length - offset + shift);
      for (var i = 0; i < num.length - offset; i += 1) {
        _num[i] = num[i + offset];
      }
      return _num;
    }();

    var _this = {};

    _this.getAt = function(index) {
      return _num[index];
    };

    _this.getLength = function() {
      return _num.length;
    };

    _this.multiply = function(e) {

      var num = new Array(_this.getLength() + e.getLength() - 1);

      for (var i = 0; i < _this.getLength(); i += 1) {
        for (var j = 0; j < e.getLength(); j += 1) {
          num[i + j] ^= QRMath.gexp(QRMath.glog(_this.getAt(i) ) + QRMath.glog(e.getAt(j) ) );
        }
      }

      return qrPolynomial(num, 0);
    };

    _this.mod = function(e) {

      if (_this.getLength() - e.getLength() < 0) {
        return _this;
      }

      var ratio = QRMath.glog(_this.getAt(0) ) - QRMath.glog(e.getAt(0) );

      var num = new Array(_this.getLength() );
      for (var i = 0; i < _this.getLength(); i += 1) {
        num[i] = _this.getAt(i);
      }

      for (var i = 0; i < e.getLength(); i += 1) {
        num[i] ^= QRMath.gexp(QRMath.glog(e.getAt(i) ) + ratio);
      }

      // recursive call
      return qrPolynomial(num, 0).mod(e);
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // QRRSBlock
  //---------------------------------------------------------------------

  var QRRSBlock = function() {

    var RS_BLOCK_TABLE = [

      // L
      // M
      // Q
      // H

      // 1
      [1, 26, 19],
      [1, 26, 16],
      [1, 26, 13],
      [1, 26, 9],

      // 2
      [1, 44, 34],
      [1, 44, 28],
      [1, 44, 22],
      [1, 44, 16],

      // 3
      [1, 70, 55],
      [1, 70, 44],
      [2, 35, 17],
      [2, 35, 13],

      // 4
      [1, 100, 80],
      [2, 50, 32],
      [2, 50, 24],
      [4, 25, 9],

      // 5
      [1, 134, 108],
      [2, 67, 43],
      [2, 33, 15, 2, 34, 16],
      [2, 33, 11, 2, 34, 12],

      // 6
      [2, 86, 68],
      [4, 43, 27],
      [4, 43, 19],
      [4, 43, 15],

      // 7
      [2, 98, 78],
      [4, 49, 31],
      [2, 32, 14, 4, 33, 15],
      [4, 39, 13, 1, 40, 14],

      // 8
      [2, 121, 97],
      [2, 60, 38, 2, 61, 39],
      [4, 40, 18, 2, 41, 19],
      [4, 40, 14, 2, 41, 15],

      // 9
      [2, 146, 116],
      [3, 58, 36, 2, 59, 37],
      [4, 36, 16, 4, 37, 17],
      [4, 36, 12, 4, 37, 13],

      // 10
      [2, 86, 68, 2, 87, 69],
      [4, 69, 43, 1, 70, 44],
      [6, 43, 19, 2, 44, 20],
      [6, 43, 15, 2, 44, 16],

      // 11
      [4, 101, 81],
      [1, 80, 50, 4, 81, 51],
      [4, 50, 22, 4, 51, 23],
      [3, 36, 12, 8, 37, 13],

      // 12
      [2, 116, 92, 2, 117, 93],
      [6, 58, 36, 2, 59, 37],
      [4, 46, 20, 6, 47, 21],
      [7, 42, 14, 4, 43, 15],

      // 13
      [4, 133, 107],
      [8, 59, 37, 1, 60, 38],
      [8, 44, 20, 4, 45, 21],
      [12, 33, 11, 4, 34, 12],

      // 14
      [3, 145, 115, 1, 146, 116],
      [4, 64, 40, 5, 65, 41],
      [11, 36, 16, 5, 37, 17],
      [11, 36, 12, 5, 37, 13],

      // 15
      [5, 109, 87, 1, 110, 88],
      [5, 65, 41, 5, 66, 42],
      [5, 54, 24, 7, 55, 25],
      [11, 36, 12, 7, 37, 13],

      // 16
      [5, 122, 98, 1, 123, 99],
      [7, 73, 45, 3, 74, 46],
      [15, 43, 19, 2, 44, 20],
      [3, 45, 15, 13, 46, 16],

      // 17
      [1, 135, 107, 5, 136, 108],
      [10, 74, 46, 1, 75, 47],
      [1, 50, 22, 15, 51, 23],
      [2, 42, 14, 17, 43, 15],

      // 18
      [5, 150, 120, 1, 151, 121],
      [9, 69, 43, 4, 70, 44],
      [17, 50, 22, 1, 51, 23],
      [2, 42, 14, 19, 43, 15],

      // 19
      [3, 141, 113, 4, 142, 114],
      [3, 70, 44, 11, 71, 45],
      [17, 47, 21, 4, 48, 22],
      [9, 39, 13, 16, 40, 14],

      // 20
      [3, 135, 107, 5, 136, 108],
      [3, 67, 41, 13, 68, 42],
      [15, 54, 24, 5, 55, 25],
      [15, 43, 15, 10, 44, 16],

      // 21
      [4, 144, 116, 4, 145, 117],
      [17, 68, 42],
      [17, 50, 22, 6, 51, 23],
      [19, 46, 16, 6, 47, 17],

      // 22
      [2, 139, 111, 7, 140, 112],
      [17, 74, 46],
      [7, 54, 24, 16, 55, 25],
      [34, 37, 13],

      // 23
      [4, 151, 121, 5, 152, 122],
      [4, 75, 47, 14, 76, 48],
      [11, 54, 24, 14, 55, 25],
      [16, 45, 15, 14, 46, 16],

      // 24
      [6, 147, 117, 4, 148, 118],
      [6, 73, 45, 14, 74, 46],
      [11, 54, 24, 16, 55, 25],
      [30, 46, 16, 2, 47, 17],

      // 25
      [8, 132, 106, 4, 133, 107],
      [8, 75, 47, 13, 76, 48],
      [7, 54, 24, 22, 55, 25],
      [22, 45, 15, 13, 46, 16],

      // 26
      [10, 142, 114, 2, 143, 115],
      [19, 74, 46, 4, 75, 47],
      [28, 50, 22, 6, 51, 23],
      [33, 46, 16, 4, 47, 17],

      // 27
      [8, 152, 122, 4, 153, 123],
      [22, 73, 45, 3, 74, 46],
      [8, 53, 23, 26, 54, 24],
      [12, 45, 15, 28, 46, 16],

      // 28
      [3, 147, 117, 10, 148, 118],
      [3, 73, 45, 23, 74, 46],
      [4, 54, 24, 31, 55, 25],
      [11, 45, 15, 31, 46, 16],

      // 29
      [7, 146, 116, 7, 147, 117],
      [21, 73, 45, 7, 74, 46],
      [1, 53, 23, 37, 54, 24],
      [19, 45, 15, 26, 46, 16],

      // 30
      [5, 145, 115, 10, 146, 116],
      [19, 75, 47, 10, 76, 48],
      [15, 54, 24, 25, 55, 25],
      [23, 45, 15, 25, 46, 16],

      // 31
      [13, 145, 115, 3, 146, 116],
      [2, 74, 46, 29, 75, 47],
      [42, 54, 24, 1, 55, 25],
      [23, 45, 15, 28, 46, 16],

      // 32
      [17, 145, 115],
      [10, 74, 46, 23, 75, 47],
      [10, 54, 24, 35, 55, 25],
      [19, 45, 15, 35, 46, 16],

      // 33
      [17, 145, 115, 1, 146, 116],
      [14, 74, 46, 21, 75, 47],
      [29, 54, 24, 19, 55, 25],
      [11, 45, 15, 46, 46, 16],

      // 34
      [13, 145, 115, 6, 146, 116],
      [14, 74, 46, 23, 75, 47],
      [44, 54, 24, 7, 55, 25],
      [59, 46, 16, 1, 47, 17],

      // 35
      [12, 151, 121, 7, 152, 122],
      [12, 75, 47, 26, 76, 48],
      [39, 54, 24, 14, 55, 25],
      [22, 45, 15, 41, 46, 16],

      // 36
      [6, 151, 121, 14, 152, 122],
      [6, 75, 47, 34, 76, 48],
      [46, 54, 24, 10, 55, 25],
      [2, 45, 15, 64, 46, 16],

      // 37
      [17, 152, 122, 4, 153, 123],
      [29, 74, 46, 14, 75, 47],
      [49, 54, 24, 10, 55, 25],
      [24, 45, 15, 46, 46, 16],

      // 38
      [4, 152, 122, 18, 153, 123],
      [13, 74, 46, 32, 75, 47],
      [48, 54, 24, 14, 55, 25],
      [42, 45, 15, 32, 46, 16],

      // 39
      [20, 147, 117, 4, 148, 118],
      [40, 75, 47, 7, 76, 48],
      [43, 54, 24, 22, 55, 25],
      [10, 45, 15, 67, 46, 16],

      // 40
      [19, 148, 118, 6, 149, 119],
      [18, 75, 47, 31, 76, 48],
      [34, 54, 24, 34, 55, 25],
      [20, 45, 15, 61, 46, 16]
    ];

    var qrRSBlock = function(totalCount, dataCount) {
      var _this = {};
      _this.totalCount = totalCount;
      _this.dataCount = dataCount;
      return _this;
    };

    var _this = {};

    var getRsBlockTable = function(typeNumber, errorCorrectionLevel) {

      switch(errorCorrectionLevel) {
      case QRErrorCorrectionLevel.L :
        return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 0];
      case QRErrorCorrectionLevel.M :
        return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 1];
      case QRErrorCorrectionLevel.Q :
        return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 2];
      case QRErrorCorrectionLevel.H :
        return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 3];
      default :
        return undefined;
      }
    };

    _this.getRSBlocks = function(typeNumber, errorCorrectionLevel) {

      var rsBlock = getRsBlockTable(typeNumber, errorCorrectionLevel);

      if (typeof rsBlock == 'undefined') {
        throw 'bad rs block @ typeNumber:' + typeNumber +
            '/errorCorrectionLevel:' + errorCorrectionLevel;
      }

      var length = rsBlock.length / 3;

      var list = [];

      for (var i = 0; i < length; i += 1) {

        var count = rsBlock[i * 3 + 0];
        var totalCount = rsBlock[i * 3 + 1];
        var dataCount = rsBlock[i * 3 + 2];

        for (var j = 0; j < count; j += 1) {
          list.push(qrRSBlock(totalCount, dataCount) );
        }
      }

      return list;
    };

    return _this;
  }();

  //---------------------------------------------------------------------
  // qrBitBuffer
  //---------------------------------------------------------------------

  var qrBitBuffer = function() {

    var _buffer = [];
    var _length = 0;

    var _this = {};

    _this.getBuffer = function() {
      return _buffer;
    };

    _this.getAt = function(index) {
      var bufIndex = Math.floor(index / 8);
      return ( (_buffer[bufIndex] >>> (7 - index % 8) ) & 1) == 1;
    };

    _this.put = function(num, length) {
      for (var i = 0; i < length; i += 1) {
        _this.putBit( ( (num >>> (length - i - 1) ) & 1) == 1);
      }
    };

    _this.getLengthInBits = function() {
      return _length;
    };

    _this.putBit = function(bit) {

      var bufIndex = Math.floor(_length / 8);
      if (_buffer.length <= bufIndex) {
        _buffer.push(0);
      }

      if (bit) {
        _buffer[bufIndex] |= (0x80 >>> (_length % 8) );
      }

      _length += 1;
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // qrNumber
  //---------------------------------------------------------------------

  var qrNumber = function(data) {

    var _mode = QRMode.MODE_NUMBER;
    var _data = data;

    var _this = {};

    _this.getMode = function() {
      return _mode;
    };

    _this.getLength = function(buffer) {
      return _data.length;
    };

    _this.write = function(buffer) {

      var data = _data;

      var i = 0;

      while (i + 2 < data.length) {
        buffer.put(strToNum(data.substring(i, i + 3) ), 10);
        i += 3;
      }

      if (i < data.length) {
        if (data.length - i == 1) {
          buffer.put(strToNum(data.substring(i, i + 1) ), 4);
        } else if (data.length - i == 2) {
          buffer.put(strToNum(data.substring(i, i + 2) ), 7);
        }
      }
    };

    var strToNum = function(s) {
      var num = 0;
      for (var i = 0; i < s.length; i += 1) {
        num = num * 10 + chatToNum(s.charAt(i) );
      }
      return num;
    };

    var chatToNum = function(c) {
      if ('0' <= c && c <= '9') {
        return c.charCodeAt(0) - '0'.charCodeAt(0);
      }
      throw 'illegal char :' + c;
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // qrAlphaNum
  //---------------------------------------------------------------------

  var qrAlphaNum = function(data) {

    var _mode = QRMode.MODE_ALPHA_NUM;
    var _data = data;

    var _this = {};

    _this.getMode = function() {
      return _mode;
    };

    _this.getLength = function(buffer) {
      return _data.length;
    };

    _this.write = function(buffer) {

      var s = _data;

      var i = 0;

      while (i + 1 < s.length) {
        buffer.put(
          getCode(s.charAt(i) ) * 45 +
          getCode(s.charAt(i + 1) ), 11);
        i += 2;
      }

      if (i < s.length) {
        buffer.put(getCode(s.charAt(i) ), 6);
      }
    };

    var getCode = function(c) {

      if ('0' <= c && c <= '9') {
        return c.charCodeAt(0) - '0'.charCodeAt(0);
      } else if ('A' <= c && c <= 'Z') {
        return c.charCodeAt(0) - 'A'.charCodeAt(0) + 10;
      } else {
        switch (c) {
        case ' ' : return 36;
        case '$' : return 37;
        case '%' : return 38;
        case '*' : return 39;
        case '+' : return 40;
        case '-' : return 41;
        case '.' : return 42;
        case '/' : return 43;
        case ':' : return 44;
        default :
          throw 'illegal char :' + c;
        }
      }
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // qr8BitByte
  //---------------------------------------------------------------------

  var qr8BitByte = function(data) {

    var _mode = QRMode.MODE_8BIT_BYTE;
    var _data = data;
    var _bytes = qrcode.stringToBytes(data);

    var _this = {};

    _this.getMode = function() {
      return _mode;
    };

    _this.getLength = function(buffer) {
      return _bytes.length;
    };

    _this.write = function(buffer) {
      for (var i = 0; i < _bytes.length; i += 1) {
        buffer.put(_bytes[i], 8);
      }
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // qrKanji
  //---------------------------------------------------------------------

  var qrKanji = function(data) {

    var _mode = QRMode.MODE_KANJI;
    var _data = data;

    var stringToBytes = qrcode.stringToBytesFuncs['SJIS'];
    if (!stringToBytes) {
      throw 'sjis not supported.';
    }
    !function(c, code) {
      // self test for sjis support.
      var test = stringToBytes(c);
      if (test.length != 2 || ( (test[0] << 8) | test[1]) != code) {
        throw 'sjis not supported.';
      }
    }('\u53cb', 0x9746);

    var _bytes = stringToBytes(data);

    var _this = {};

    _this.getMode = function() {
      return _mode;
    };

    _this.getLength = function(buffer) {
      return ~~(_bytes.length / 2);
    };

    _this.write = function(buffer) {

      var data = _bytes;

      var i = 0;

      while (i + 1 < data.length) {

        var c = ( (0xff & data[i]) << 8) | (0xff & data[i + 1]);

        if (0x8140 <= c && c <= 0x9FFC) {
          c -= 0x8140;
        } else if (0xE040 <= c && c <= 0xEBBF) {
          c -= 0xC140;
        } else {
          throw 'illegal char at ' + (i + 1) + '/' + c;
        }

        c = ( (c >>> 8) & 0xff) * 0xC0 + (c & 0xff);

        buffer.put(c, 13);

        i += 2;
      }

      if (i < data.length) {
        throw 'illegal char at ' + (i + 1);
      }
    };

    return _this;
  };

  //=====================================================================
  // GIF Support etc.
  //

  //---------------------------------------------------------------------
  // byteArrayOutputStream
  //---------------------------------------------------------------------

  var byteArrayOutputStream = function() {

    var _bytes = [];

    var _this = {};

    _this.writeByte = function(b) {
      _bytes.push(b & 0xff);
    };

    _this.writeShort = function(i) {
      _this.writeByte(i);
      _this.writeByte(i >>> 8);
    };

    _this.writeBytes = function(b, off, len) {
      off = off || 0;
      len = len || b.length;
      for (var i = 0; i < len; i += 1) {
        _this.writeByte(b[i + off]);
      }
    };

    _this.writeString = function(s) {
      for (var i = 0; i < s.length; i += 1) {
        _this.writeByte(s.charCodeAt(i) );
      }
    };

    _this.toByteArray = function() {
      return _bytes;
    };

    _this.toString = function() {
      var s = '';
      s += '[';
      for (var i = 0; i < _bytes.length; i += 1) {
        if (i > 0) {
          s += ',';
        }
        s += _bytes[i];
      }
      s += ']';
      return s;
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // base64EncodeOutputStream
  //---------------------------------------------------------------------

  var base64EncodeOutputStream = function() {

    var _buffer = 0;
    var _buflen = 0;
    var _length = 0;
    var _base64 = '';

    var _this = {};

    var writeEncoded = function(b) {
      _base64 += String.fromCharCode(encode(b & 0x3f) );
    };

    var encode = function(n) {
      if (n < 0) {
        // error.
      } else if (n < 26) {
        return 0x41 + n;
      } else if (n < 52) {
        return 0x61 + (n - 26);
      } else if (n < 62) {
        return 0x30 + (n - 52);
      } else if (n == 62) {
        return 0x2b;
      } else if (n == 63) {
        return 0x2f;
      }
      throw 'n:' + n;
    };

    _this.writeByte = function(n) {

      _buffer = (_buffer << 8) | (n & 0xff);
      _buflen += 8;
      _length += 1;

      while (_buflen >= 6) {
        writeEncoded(_buffer >>> (_buflen - 6) );
        _buflen -= 6;
      }
    };

    _this.flush = function() {

      if (_buflen > 0) {
        writeEncoded(_buffer << (6 - _buflen) );
        _buffer = 0;
        _buflen = 0;
      }

      if (_length % 3 != 0) {
        // padding
        var padlen = 3 - _length % 3;
        for (var i = 0; i < padlen; i += 1) {
          _base64 += '=';
        }
      }
    };

    _this.toString = function() {
      return _base64;
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // base64DecodeInputStream
  //---------------------------------------------------------------------

  var base64DecodeInputStream = function(str) {

    var _str = str;
    var _pos = 0;
    var _buffer = 0;
    var _buflen = 0;

    var _this = {};

    _this.read = function() {

      while (_buflen < 8) {

        if (_pos >= _str.length) {
          if (_buflen == 0) {
            return -1;
          }
          throw 'unexpected end of file./' + _buflen;
        }

        var c = _str.charAt(_pos);
        _pos += 1;

        if (c == '=') {
          _buflen = 0;
          return -1;
        } else if (c.match(/^\s$/) ) {
          // ignore if whitespace.
          continue;
        }

        _buffer = (_buffer << 6) | decode(c.charCodeAt(0) );
        _buflen += 6;
      }

      var n = (_buffer >>> (_buflen - 8) ) & 0xff;
      _buflen -= 8;
      return n;
    };

    var decode = function(c) {
      if (0x41 <= c && c <= 0x5a) {
        return c - 0x41;
      } else if (0x61 <= c && c <= 0x7a) {
        return c - 0x61 + 26;
      } else if (0x30 <= c && c <= 0x39) {
        return c - 0x30 + 52;
      } else if (c == 0x2b) {
        return 62;
      } else if (c == 0x2f) {
        return 63;
      } else {
        throw 'c:' + c;
      }
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // gifImage (B/W)
  //---------------------------------------------------------------------

  var gifImage = function(width, height) {

    var _width = width;
    var _height = height;
    var _data = new Array(width * height);

    var _this = {};

    _this.setPixel = function(x, y, pixel) {
      _data[y * _width + x] = pixel;
    };

    _this.write = function(out) {

      //---------------------------------
      // GIF Signature

      out.writeString('GIF87a');

      //---------------------------------
      // Screen Descriptor

      out.writeShort(_width);
      out.writeShort(_height);

      out.writeByte(0x80); // 2bit
      out.writeByte(0);
      out.writeByte(0);

      //---------------------------------
      // Global Color Map

      // black
      out.writeByte(0x00);
      out.writeByte(0x00);
      out.writeByte(0x00);

      // white
      out.writeByte(0xff);
      out.writeByte(0xff);
      out.writeByte(0xff);

      //---------------------------------
      // Image Descriptor

      out.writeString(',');
      out.writeShort(0);
      out.writeShort(0);
      out.writeShort(_width);
      out.writeShort(_height);
      out.writeByte(0);

      //---------------------------------
      // Local Color Map

      //---------------------------------
      // Raster Data

      var lzwMinCodeSize = 2;
      var raster = getLZWRaster(lzwMinCodeSize);

      out.writeByte(lzwMinCodeSize);

      var offset = 0;

      while (raster.length - offset > 255) {
        out.writeByte(255);
        out.writeBytes(raster, offset, 255);
        offset += 255;
      }

      out.writeByte(raster.length - offset);
      out.writeBytes(raster, offset, raster.length - offset);
      out.writeByte(0x00);

      //---------------------------------
      // GIF Terminator
      out.writeString(';');
    };

    var bitOutputStream = function(out) {

      var _out = out;
      var _bitLength = 0;
      var _bitBuffer = 0;

      var _this = {};

      _this.write = function(data, length) {

        if ( (data >>> length) != 0) {
          throw 'length over';
        }

        while (_bitLength + length >= 8) {
          _out.writeByte(0xff & ( (data << _bitLength) | _bitBuffer) );
          length -= (8 - _bitLength);
          data >>>= (8 - _bitLength);
          _bitBuffer = 0;
          _bitLength = 0;
        }

        _bitBuffer = (data << _bitLength) | _bitBuffer;
        _bitLength = _bitLength + length;
      };

      _this.flush = function() {
        if (_bitLength > 0) {
          _out.writeByte(_bitBuffer);
        }
      };

      return _this;
    };

    var getLZWRaster = function(lzwMinCodeSize) {

      var clearCode = 1 << lzwMinCodeSize;
      var endCode = (1 << lzwMinCodeSize) + 1;
      var bitLength = lzwMinCodeSize + 1;

      // Setup LZWTable
      var table = lzwTable();

      for (var i = 0; i < clearCode; i += 1) {
        table.add(String.fromCharCode(i) );
      }
      table.add(String.fromCharCode(clearCode) );
      table.add(String.fromCharCode(endCode) );

      var byteOut = byteArrayOutputStream();
      var bitOut = bitOutputStream(byteOut);

      // clear code
      bitOut.write(clearCode, bitLength);

      var dataIndex = 0;

      var s = String.fromCharCode(_data[dataIndex]);
      dataIndex += 1;

      while (dataIndex < _data.length) {

        var c = String.fromCharCode(_data[dataIndex]);
        dataIndex += 1;

        if (table.contains(s + c) ) {

          s = s + c;

        } else {

          bitOut.write(table.indexOf(s), bitLength);

          if (table.size() < 0xfff) {

            if (table.size() == (1 << bitLength) ) {
              bitLength += 1;
            }

            table.add(s + c);
          }

          s = c;
        }
      }

      bitOut.write(table.indexOf(s), bitLength);

      // end code
      bitOut.write(endCode, bitLength);

      bitOut.flush();

      return byteOut.toByteArray();
    };

    var lzwTable = function() {

      var _map = {};
      var _size = 0;

      var _this = {};

      _this.add = function(key) {
        if (_this.contains(key) ) {
          throw 'dup key:' + key;
        }
        _map[key] = _size;
        _size += 1;
      };

      _this.size = function() {
        return _size;
      };

      _this.indexOf = function(key) {
        return _map[key];
      };

      _this.contains = function(key) {
        return typeof _map[key] != 'undefined';
      };

      return _this;
    };

    return _this;
  };

  var createDataURL = function(width, height, getPixel) {
    var gif = gifImage(width, height);
    for (var y = 0; y < height; y += 1) {
      for (var x = 0; x < width; x += 1) {
        gif.setPixel(x, y, getPixel(x, y) );
      }
    }

    var b = byteArrayOutputStream();
    gif.write(b);

    var base64 = base64EncodeOutputStream();
    var bytes = b.toByteArray();
    for (var i = 0; i < bytes.length; i += 1) {
      base64.writeByte(bytes[i]);
    }
    base64.flush();

    return 'data:image/gif;base64,' + base64;
  };

  //---------------------------------------------------------------------
  // returns qrcode function.

  return qrcode;
}();

// multibyte support
!function() {

  qrcode.stringToBytesFuncs['UTF-8'] = function(s) {
    // http://stackoverflow.com/questions/18729405/how-to-convert-utf8-string-to-byte-array
    function toUTF8Array(str) {
      var utf8 = [];
      for (var i=0; i < str.length; i++) {
        var charcode = str.charCodeAt(i);
        if (charcode < 0x80) utf8.push(charcode);
        else if (charcode < 0x800) {
          utf8.push(0xc0 | (charcode >> 6),
              0x80 | (charcode & 0x3f));
        }
        else if (charcode < 0xd800 || charcode >= 0xe000) {
          utf8.push(0xe0 | (charcode >> 12),
              0x80 | ((charcode>>6) & 0x3f),
              0x80 | (charcode & 0x3f));
        }
        // surrogate pair
        else {
          i++;
          // UTF-16 encodes 0x10000-0x10FFFF by
          // subtracting 0x10000 and splitting the
          // 20 bits of 0x0-0xFFFFF into two halves
          charcode = 0x10000 + (((charcode & 0x3ff)<<10)
            | (str.charCodeAt(i) & 0x3ff));
          utf8.push(0xf0 | (charcode >>18),
              0x80 | ((charcode>>12) & 0x3f),
              0x80 | ((charcode>>6) & 0x3f),
              0x80 | (charcode & 0x3f));
        }
      }
      return utf8;
    }
    return toUTF8Array(s);
  };

}();

    const React = require('react')
    const h = React.createElement
    // react-dom is part of the DSH platform module table; the viewer is
    // portalled to <body> so no transformed/clipped ancestor can trap it.
    let ReactDOM = null
    try { ReactDOM = require('react-dom') } catch (error) { ReactDOM = null }
    const NS = 'study-coach'
    const DAY_MS = 86400000
    const MAX_FRONT = 4000
    const MAX_BACK = 8000
    const MAX_CARDS = 500
    const DEFAULT_DECK = '默认'

    // ------------------------------------------------------------------
    // Locale
    // ------------------------------------------------------------------
    const ZH = {
      'nav.title': '学习教练',
      'dock.label': '学习',
      'dock.due': '{n} 张待复习',
      'dock.done': '今日已完成',
      'dock.start': '开始学习',
      'page.title': '学习中心',
      'page.subtitle': '主动回忆 × 间隔重复；读取雨课堂课件，生成学习计划与考点清单。',
      'tab.review': '复习',
      'tab.library': '卡片库',
      'tab.stats': '学习统计',
      'tab.ykt': '雨课堂',
      'ykt.loading': '正在读取雨课堂数据…',
      'ykt.loadingSlides': '正在加载课件…',
      'ykt.working': '处理中…',
      'ykt.loginTitle': '连接雨课堂',
      'ykt.loginBody': '登录后即可在这里选择课程、读取课件，并让 DeepSeek 生成学习计划与考点清单。',
      'ykt.region': '雨课堂区域',
      'ykt.region.standard': '雨课堂（默认）',
      'ykt.region.hetang': '荷塘雨课堂',
      'ykt.region.changjiang': '长江雨课堂',
      'ykt.region.huanghe': '黄河雨课堂',
      'ykt.session': 'sessionid / 完整 Cookie',
      'ykt.sessionPlaceholder': '粘贴完整 Cookie（含 sessionid、csrftoken、university_id）',
      'ykt.sessionRequired': '请先填写 sessionid',
      'ykt.loginAction': '保存并验证',
      'ykt.loginHelp': '推荐复制浏览器里整段 Cookie（至少包含 sessionid；长江/荷塘等区域通常还需要 csrftoken 与 university_id）。F12 → Network → 任意请求 → 复制 Cookie 请求头。会话只保存在本机。',
      'ykt.qrMode': '扫码登录',
      'ykt.sessionMode': 'sessionid 登录',
      'ykt.getQr': '获取二维码',
      'ykt.refreshQr': '刷新二维码',
      'ykt.scanHint': '用微信扫一扫，或在雨课堂 App 中扫码确认。二维码约 5 分钟有效。',
      'ykt.qrAlt': '雨课堂登录二维码',
      'ykt.qrExpired': '二维码已过期，请重新获取。',
      'ykt.bridgeMissing': '本地雨课堂桥接接口未加载（404）。请刷新页面；若仍失败，请确认插件已启用。',
      'ykt.cookie500': '雨课堂课程列表返回 500。常见原因：1) 区域选择与账号不一致；2) Cookie 缺少 csrftoken / university_id。请退出后选对区域，并用「完整 Cookie」重新登录。',
      'ykt.loginSuccess': '已连接雨课堂',
      'ykt.logout': '退出登录',
      'ykt.logoutDone': '已清除雨课堂会话',
      'ykt.loggedAs': '已登录：{name}',
      'ykt.unnamed': '未命名账号',
      'ykt.searchCourse': '搜索课程…',
      'ykt.noCourses': '没有读到课程',
      'ykt.noCoursesBody': '请确认区域选择正确、sessionid 未过期；重新登录后再试。',
      'ykt.term': '学期 {term}',
      'ykt.openCourse': '查看课程',
      'ykt.backToCourses': '← 返回课程',
      'ykt.backToCourse': '← 返回课程',
      'ykt.courseware': '课件',
      'ykt.lessons': '课堂记录',
      'ykt.progressTab': '章节计划',
      'ykt.noLessons': '这节课还没有课堂记录。',
      'ykt.noProgress': '没有读取到章节进度。',
      'ykt.lesson': '课堂',
      'ykt.attended': '已参加',
      'ykt.notAttended': '未参加',
      'ykt.analyze': '复制分析指令',
      'ykt.analyzeHint': '点击后会复制一段分析指令；粘贴到下方输入框发送，DeepSeek 会读取本课课件、回放、思维导图与章节进度，输出学习计划和考点清单，并生成复习卡片。',
      'ykt.promptCopied': '分析指令已复制，请粘贴到输入框发送。',
      'ykt.copyFailed': '复制失败：{detail}',
      'ykt.refresh': '刷新',
      'ykt.slideN': '第 {n} 页',
      'ykt.slideAlt': '课件第 {n} 页',
      'ykt.noSlides': '该课件没有可显示的页面。',
      'ykt.model': '模型',
      'ykt.modelDefault': '跟随默认模型',
      'ykt.modelHint': 'AI 总结和课件对话使用这个模型；建议选择支持图片的模型。',
      'ykt.modelVision': '支持图片',
      'ykt.modelTextOnly': '仅文本',
      'ykt.modelSaveFailed': '模型保存失败：{detail}',
      'ykt.summary': 'AI 总结',
      'ykt.summaryStart': 'AI 总结本节',
      'ykt.summaryStartPicked': 'AI 总结所选页（排除 {n} 页）',
      'ykt.pickCount': '本课件参与总结：{picked} / {total} 页',
      'ykt.pickOther': '其他课件另有 {n} 页未勾选',
      'ykt.pickAll': '全选',
      'ykt.pickNone': '全不选',
      'ykt.pickInvert': '反选',
      'ykt.pickHint': '取消勾选的页不会交给 AI 总结。',
      'ykt.pickSlide': '第 {n} 页参与 AI 总结',
      'ykt.pickExcluded': '不参与总结',
      'ykt.pickEmpty': '请至少勾选一页课件再总结。',
      'ykt.summaryAgain': '重新总结',
      'ykt.summaryCancel': '取消总结',
      'ykt.summaryRunning': 'AI 正在阅读本节全部课件（{done}/{total} 页）…',
      'ykt.summaryInProgress': '总结中 {pct}%',
      'ykt.summaryPhase.prepare': '正在准备课件…',
      'ykt.summaryPhase.read': 'AI 正在逐页阅读课件…',
      'ykt.summaryPhase.compose': '正在整合知识点与考点…',
      'ykt.summaryPhase.done': '总结完成',
      'ykt.summaryDone': '已生成知识点总结',
      'ykt.summaryFailed': 'AI 总结失败：{detail}',
      'ykt.summaryEmpty': '还没有 AI 总结。点击后 AI 会阅读本节全部课件页面，整理知识点、考点和复习计划。',
      'ykt.summaryHint': 'AI 会读取本课时勾选的课件页（默认全部勾选，可在下方缩略图上取消），并生成结构化知识点总结。',
      'ykt.summaryCached': '上次生成',
      'ykt.summaryCopy': '复制 Markdown',
      'ykt.summaryCopied': '总结已复制到剪贴板',
      'ykt.summaryCards': '加入复习卡组',
      'ykt.summaryCardsDone': '已加入 {n} 张复习卡片',
      'ykt.summaryCardsEmpty': '没有新增卡片（可能已经存在）',
      'ykt.summaryCardsFailed': '生成卡片失败：{detail}',
      'ykt.summarySlides': '共 {n} 页课件',
      'ykt.summaryTruncated': '已读 {read}/{total} 页（超出单次上限）',
      'ykt.summaryWarning': '有 {n} 份课件读取失败，总结可能不完整。',
      'ykt.summaryModel': '模型：{name}',
      'ykt.board': '知识看板',
      'ykt.boardStats': '{trees} 棵知识树 · {nodes} 个知识点',
      'ykt.boardLive': 'AI 正在边读边长知识树…',
      'ykt.boardWaiting': 'AI 读完第一批课件后，知识树会在这里一点点长出来。',
      'ykt.boardMissing': '这份总结生成于知识看板上线之前，点「重新总结」即可生成知识树。',
      'ykt.boardGrowing': '正在长出第一个知识点…',
      'ykt.boardExpandAll': '全部展开',
      'ykt.boardCollapseAll': '全部收起',
      'ykt.boardExpand': '展开',
      'ykt.boardCollapse': '收起',
      'ykt.boardTaller': '放大看板',
      'ykt.boardShorter': '缩小看板',
      'ykt.boardPage': '第 {n} 页',
      'ykt.boardOpenPage': '打开课件第 {n} 页',
      'ykt.boardPageMissing': '当前课件里没有第 {n} 页，可能在另一份课件中，请先切换课件。',
      'ykt.boardAsk': '问 AI',
      'ykt.boardAskHint': '右键知识点可以向 AI 提问',
      'ykt.boardAskMenu': '向 AI 提问',
      'ykt.boardAsk.explain': '详细解释这个知识点',
      'ykt.boardAsk.example': '举一个具体的例子',
      'ykt.boardAsk.relation': '它和上下级、同级知识点有什么联系？',
      'ykt.boardAsk.exam': '出一道练习题，并给出解析',
      'ykt.boardAsk.custom': '自定义提问…',
      'ykt.boardAsk.copy': '复制知识点',
      'ykt.boardAskShort.explain': '详细解释',
      'ykt.boardAskShort.example': '举个例子',
      'ykt.boardAskShort.relation': '知识联系',
      'ykt.boardAskShort.exam': '出道练习题',
      'ykt.boardChatTitle': '问 AI：{label}',
      'ykt.boardChatEmpty': '选一个快捷问题，或在下方输入你想问的。AI 会结合它在知识树中的位置和对应课件页回答。',
      'ykt.boardChatPlaceholder': '就「{label}」提问或追问…',
      'ykt.boardChatClose': '关闭问答',
      'ykt.boardCopied': '已复制知识点',
      'ykt.knowledgePoints': '核心知识点',
      'ykt.examPoints': '考点清单',
      'ykt.pitfalls': '易错点',
      'ykt.studyPlan': '复习计划',
      'ykt.importance.high': '重点',
      'ykt.importance.medium': '掌握',
      'ykt.importance.low': '了解',
      'ykt.pageN': '第 {n} 页',
      'ykt.viewerOpen': '放大查看',
      'ykt.viewerHint': '选「高亮/圈画」后直接在页面上拖动；滚轮缩放，选「拖动」可平移。',
      'ykt.zoomIn': '放大',
      'ykt.zoomOut': '缩小',
      'ykt.zoomReset': '适应窗口',
      'ykt.prevPage': '上一页',
      'ykt.nextPage': '下一页',
      'ykt.close': '关闭',
      'ykt.tool.pan': '拖动',
      'ykt.tool.highlight': '高亮',
      'ykt.tool.pen': '圈画',
      'ykt.tool.eraser': '橡皮',
      'ykt.tool.undo': '撤销',
      'ykt.tool.clear': '清空',
      'ykt.annotated': '已标注 {n} 处',
      'ykt.chatTitle': '本页 AI 对话',
      'ykt.chatEmpty': '针对这一页提问，或先用高亮/圈画标出不懂的地方，再提问。',
      'ykt.chatPlaceholder': '问这一页的任何问题…',
      'ykt.chatSend': '发送',
      'ykt.chatThinking': 'AI 正在思考…',
      'ykt.chatClear': '清空对话',
      'ykt.chatStoreHint': '单页对话和看板对话只在本机保存文字（每节课最多 60 段、每段保留最近 30 条）；发给 AI 的图片用完即删。',
      'ykt.chatStoreClear': '清空本节课保存的对话',
      'ykt.chatStoreCleared': '已清空本节课保存的对话',
      'ykt.chatQuick1': '解释这一页',
      'ykt.chatQuick2': '这页的考点是什么？',
      'ykt.chatQuick3': '圈出的部分是什么意思？',
      'ykt.chatFailed': 'AI 回复失败：{detail}',
      'ykt.chatAnnotation': '提问将聚焦你标注的 {n} 处：AI 先看圈画处的放大图再回答',
      'ykt.chatNoModel': '请先选择一个支持图片的模型',
      'ykt.deadline': '截止',
      'ykt.leafType.0': '视频',
      'ykt.leafType.3': '推荐',
      'ykt.leafType.4': '讨论',
      'ykt.leafType.5': '考试/作业',
      'ykt.leafType.6': '作业',
      'ykt.leafType.8': '签到/课堂',
      'ykt.leafType.19': '章节作业',
      'ykt.analysisPrompt': '请用 ykt 工具分析我的雨课堂课程「{course}」中的课时「{lesson}」（lessonId={lessonId}，classroomId={classroomId}，courseId={courseId}）。先读取 lesson、slides（attach=true，最多 12 页）、replay、mind_map 和 progress，然后基于课件图片输出：1）学习计划（按日期与优先级，标出截止时间）；2）考点清单（按重要度，标注对应课件页）；3）用 study 工具把考点做成原子化复习卡片。',
      'stats.due': '今日待复习',
      'stats.streak': '连续学习',
      'stats.today': '今日已复习',
      'stats.total': '卡片总数',
      'stats.mastered': '已掌握',
      'stats.learning': '学习中',
      'stats.fresh': '新卡片',
      'stats.unit.card': '张',
      'stats.unit.day': '天',
      'review.start': '开始今日复习',
      'review.startAll': '复习全部卡片',
      'review.emptyTitle': '今天没有到期的卡片',
      'review.emptyBody': '间隔重复的美妙之处就在于此：该休息的时候好好休息。你也可以提前复习，或让 DeepSeek 帮你添加新卡片。',
      'review.doneTitle': '今日复习完成',
      'review.doneBody': '你刚刚复习了 {n} 张卡片，连续学习 {streak} 天。',
      'review.againRound': '再来一轮',
      'review.progress': '第 {index} / {total} 张',
      'review.reveal': '显示答案',
      'review.hint': '空格显示答案 · 1–4 评分',
      'review.skip': '稍后再看',
      'review.again': '忘记',
      'review.hard': '困难',
      'review.good': '良好',
      'review.easy': '简单',
      'review.againHint': '10 分钟后',
      'review.hardHint': '{n}后',
      'review.goodHint': '{n}后',
      'review.easyHint': '{n}后',
      'review.front': '问题',
      'review.back': '答案',
      'review.deck': '卡组',
      'review.noCards': '还没有卡片',
      'library.search': '搜索卡片…',
      'library.allDecks': '全部卡组',
      'library.add': '新建卡片',
      'library.newFront': '正面：一个明确的问题',
      'library.newBack': '背面：简短、可判断对错的答案',
      'library.newDeck': '卡组名称（可选）',
      'library.defaultDeck': '默认',
      'library.save': '保存卡片',
      'library.cancel': '取消',
      'library.delete': '删除',
      'library.confirmDelete': '确认删除',
      'library.edit': '编辑',
      'library.empty': '没有匹配的卡片',
      'library.count': '共 {n} 张',
      'library.limit': '卡片数量上限为 {n} 张，请先删除一些卡片。',
      'library.dueNow': '待复习',
      'library.nextDue': '下次 {when}',
      'library.reps': '复习 {n} 次',
      'library.saveEdit': '保存修改',
      'stats.week': '最近 7 天复习量',
      'stats.mastery': '掌握分布',
      'stats.decks': '卡组分布',
      'stats.goal': '每日目标',
      'stats.goalHint': '每天计划复习的卡片数量',
      'stats.noData': '还没有复习记录',
      'stats.mastery.new': '新卡片',
      'stats.mastery.learning': '学习中',
      'stats.mastery.mature': '已掌握',
      'common.loading': '正在读取学习数据…',
      'common.offline': '学习数据暂不可用',
      'common.offlineBody': '请确认桌面版 Harness 的设置服务已启动，然后重试。',
      'common.retry': '重试',
      'common.saveFailed': '保存失败：{detail}',
      'common.today': '今天',
      'common.minutes': '{n} 分钟',
      'common.hours': '{n} 小时',
      'common.days': '{n} 天',
      'common.justNow': '现在',
    }

    const EN = {
      'nav.title': 'Learning Coach',
      'dock.label': 'Study',
      'dock.due': '{n} due',
      'dock.done': 'Done today',
      'dock.start': 'Start studying',
      'page.title': 'Learning Coach',
      'page.subtitle': 'Active recall × spaced repetition — read Yuketang courseware and turn it into a plan and exam points.',
      'tab.review': 'Review',
      'tab.library': 'Library',
      'tab.stats': 'Progress',
      'tab.ykt': 'Yuketang',
      'ykt.loading': 'Loading Yuketang data…',
      'ykt.loadingSlides': 'Loading slides…',
      'ykt.working': 'Working…',
      'ykt.loginTitle': 'Connect Yuketang',
      'ykt.loginBody': 'Sign in to pick a course, read its courseware, and let DeepSeek build a study plan and exam-point list.',
      'ykt.region': 'Yuketang region',
      'ykt.region.standard': 'Yuketang (default)',
      'ykt.region.hetang': 'Hetang Yuketang',
      'ykt.region.changjiang': 'Changjiang Yuketang',
      'ykt.region.huanghe': 'Huanghe Yuketang',
      'ykt.session': 'sessionid / full Cookie',
      'ykt.sessionPlaceholder': 'Paste the full Cookie header (sessionid, csrftoken, university_id)',
      'ykt.sessionRequired': 'Enter a sessionid first',
      'ykt.loginAction': 'Save & verify',
      'ykt.loginHelp': 'Copy the full Cookie header from any request (at minimum sessionid; csrftoken and university_id are often required on Changjiang/Hetang). The session stays on this machine.',
      'ykt.qrMode': 'Scan QR',
      'ykt.sessionMode': 'sessionid',
      'ykt.getQr': 'Get QR code',
      'ykt.refreshQr': 'Refresh QR',
      'ykt.scanHint': 'Scan with WeChat or the Yuketang app. The QR code is valid for about 5 minutes.',
      'ykt.qrAlt': 'Yuketang login QR code',
      'ykt.qrExpired': 'The QR code expired. Request a new one.',
      'ykt.bridgeMissing': 'The local Yuketang bridge is not loaded (404). Refresh the page; if it persists, confirm the plugin is enabled.',
      'ykt.cookie500': 'The Yuketang course list returned HTTP 500. Common causes: (1) wrong region; (2) the Cookie is missing csrftoken / university_id. Sign out, pick the right region, and log in with the full Cookie header.',
      'ykt.loginSuccess': 'Connected to Yuketang',
      'ykt.logout': 'Sign out',
      'ykt.logoutDone': 'Yuketang session cleared',
      'ykt.loggedAs': 'Signed in: {name}',
      'ykt.unnamed': 'Unnamed account',
      'ykt.searchCourse': 'Search courses…',
      'ykt.noCourses': 'No courses found',
      'ykt.noCoursesBody': 'Check the region and that the sessionid is still valid, then sign in again.',
      'ykt.term': 'Term {term}',
      'ykt.openCourse': 'Open course',
      'ykt.backToCourses': '← Courses',
      'ykt.backToCourse': '← Course',
      'ykt.courseware': 'Courseware',
      'ykt.lessons': 'Lessons',
      'ykt.progressTab': 'Chapter plan',
      'ykt.noLessons': 'No lesson records for this course yet.',
      'ykt.noProgress': 'No chapter progress found.',
      'ykt.lesson': 'Lesson',
      'ykt.attended': 'Attended',
      'ykt.notAttended': 'Not attended',
      'ykt.analyze': 'Copy analysis prompt',
      'ykt.analyzeHint': 'Copies an analysis prompt. Paste it into the composer: DeepSeek will read this lesson\'s slides, replay, mind map and chapter progress, then produce a study plan and exam-point list and create review cards.',
      'ykt.promptCopied': 'Prompt copied — paste it into the composer to send.',
      'ykt.copyFailed': 'Copy failed: {detail}',
      'ykt.refresh': 'Refresh',
      'ykt.slideN': 'Slide {n}',
      'ykt.slideAlt': 'Courseware slide {n}',
      'ykt.noSlides': 'No slide pages available for this courseware.',
      'ykt.model': 'Model',
      'ykt.modelDefault': 'Use default model',
      'ykt.modelHint': 'AI summaries and slide chat use this model; a vision-capable model is recommended.',
      'ykt.modelVision': 'Vision',
      'ykt.modelTextOnly': 'Text only',
      'ykt.modelSaveFailed': 'Could not save the model: {detail}',
      'ykt.summary': 'AI summary',
      'ykt.summaryStart': 'Summarize this lesson',
      'ykt.summaryStartPicked': 'Summarize selected slides ({n} excluded)',
      'ykt.pickCount': 'Included in summary: {picked} / {total} slides',
      'ykt.pickOther': '{n} more slides unticked in other decks',
      'ykt.pickAll': 'Select all',
      'ykt.pickNone': 'Select none',
      'ykt.pickInvert': 'Invert',
      'ykt.pickHint': 'Unticked slides are not sent to the AI summary.',
      'ykt.pickSlide': 'Include slide {n} in the AI summary',
      'ykt.pickExcluded': 'Excluded',
      'ykt.pickEmpty': 'Tick at least one slide before summarizing.',
      'ykt.summaryAgain': 'Regenerate summary',
      'ykt.summaryCancel': 'Cancel summary',
      'ykt.summaryRunning': 'AI is reading all courseware ({done}/{total} slides)…',
      'ykt.summaryInProgress': 'Summarizing {pct}%',
      'ykt.summaryPhase.prepare': 'Preparing courseware…',
      'ykt.summaryPhase.read': 'AI is reading the slides page by page…',
      'ykt.summaryPhase.compose': 'Assembling knowledge points and exam points…',
      'ykt.summaryPhase.done': 'Summary ready',
      'ykt.summaryDone': 'Knowledge-point summary generated',
      'ykt.summaryFailed': 'AI summary failed: {detail}',
      'ykt.summaryEmpty': 'No AI summary yet. One click makes AI read every slide of this lesson and produce knowledge points, exam points and a study plan.',
      'ykt.summaryHint': 'AI reads every ticked slide in this lesson (all are ticked by default; untick thumbnails below to skip them) and produces a structured knowledge-point summary.',
      'ykt.summaryCached': 'Generated previously',
      'ykt.summaryCopy': 'Copy Markdown',
      'ykt.summaryCopied': 'Summary copied to clipboard',
      'ykt.summaryCards': 'Add to review deck',
      'ykt.summaryCardsDone': 'Added {n} review cards',
      'ykt.summaryCardsEmpty': 'No new cards (they may already exist)',
      'ykt.summaryCardsFailed': 'Could not create cards: {detail}',
      'ykt.summarySlides': '{n} slides',
      'ykt.summaryTruncated': 'Read {read}/{total} slides (single-run limit)',
      'ykt.summaryWarning': '{n} courseware item(s) could not be read; the summary may be incomplete.',
      'ykt.summaryModel': 'Model: {name}',
      'ykt.board': 'Knowledge board',
      'ykt.boardStats': '{trees} trees · {nodes} concepts',
      'ykt.boardLive': 'AI is growing the trees as it reads…',
      'ykt.boardWaiting': 'Knowledge trees start growing here once AI finishes the first batch of slides.',
      'ykt.boardMissing': 'This summary predates the knowledge board. Regenerate it to grow knowledge trees.',
      'ykt.boardGrowing': 'Growing the first concept…',
      'ykt.boardExpandAll': 'Expand all',
      'ykt.boardCollapseAll': 'Collapse all',
      'ykt.boardExpand': 'Expand',
      'ykt.boardCollapse': 'Collapse',
      'ykt.boardTaller': 'Taller board',
      'ykt.boardShorter': 'Shorter board',
      'ykt.boardPage': 'Slide {n}',
      'ykt.boardOpenPage': 'Open slide {n}',
      'ykt.boardPageMissing': 'Slide {n} is not in the current courseware; switch courseware first.',
      'ykt.boardAsk': 'Ask AI',
      'ykt.boardAskHint': 'Right-click a concept to ask AI about it',
      'ykt.boardAskMenu': 'Ask AI',
      'ykt.boardAsk.explain': 'Explain this concept in detail',
      'ykt.boardAsk.example': 'Give a concrete example',
      'ykt.boardAsk.relation': 'How does it relate to its parent, children and siblings?',
      'ykt.boardAsk.exam': 'Write a practice question with a worked answer',
      'ykt.boardAsk.custom': 'Ask something else…',
      'ykt.boardAsk.copy': 'Copy concept',
      'ykt.boardAskShort.explain': 'Explain',
      'ykt.boardAskShort.example': 'Example',
      'ykt.boardAskShort.relation': 'Relations',
      'ykt.boardAskShort.exam': 'Practice question',
      'ykt.boardChatTitle': 'Ask AI: {label}',
      'ykt.boardChatEmpty': 'Pick a quick question or type your own. AI answers using the concept’s place in the tree and its slides.',
      'ykt.boardChatPlaceholder': 'Ask or follow up about “{label}”…',
      'ykt.boardChatClose': 'Close Q&A',
      'ykt.boardCopied': 'Concept copied',
      'ykt.knowledgePoints': 'Key knowledge points',
      'ykt.examPoints': 'Exam points',
      'ykt.pitfalls': 'Common pitfalls',
      'ykt.studyPlan': 'Study plan',
      'ykt.importance.high': 'Core',
      'ykt.importance.medium': 'Know',
      'ykt.importance.low': 'Aware',
      'ykt.pageN': 'Page {n}',
      'ykt.viewerOpen': 'Open large view',
      'ykt.viewerHint': 'Pick Highlight or Draw, then drag directly on the page. Wheel to zoom; pick Pan to move.',
      'ykt.zoomIn': 'Zoom in',
      'ykt.zoomOut': 'Zoom out',
      'ykt.zoomReset': 'Fit to window',
      'ykt.prevPage': 'Previous page',
      'ykt.nextPage': 'Next page',
      'ykt.close': 'Close',
      'ykt.tool.pan': 'Pan',
      'ykt.tool.highlight': 'Highlight',
      'ykt.tool.pen': 'Draw',
      'ykt.tool.eraser': 'Eraser',
      'ykt.tool.undo': 'Undo',
      'ykt.tool.clear': 'Clear',
      'ykt.annotated': '{n} annotations',
      'ykt.chatTitle': 'Ask AI about this page',
      'ykt.chatEmpty': 'Ask about this page, or highlight/draw the confusing part first, then ask.',
      'ykt.chatPlaceholder': 'Ask anything about this page…',
      'ykt.chatSend': 'Send',
      'ykt.chatThinking': 'AI is thinking…',
      'ykt.chatClear': 'Clear chat',
      'ykt.chatStoreHint': 'Slide and board chats are saved locally as text only (up to 60 threads per lesson, last 30 messages each); images sent to the AI are deleted right after use.',
      'ykt.chatStoreClear': 'Clear saved chats for this lesson',
      'ykt.chatStoreCleared': 'Saved chats for this lesson were cleared',
      'ykt.chatQuick1': 'Explain this page',
      'ykt.chatQuick2': 'What are the exam points here?',
      'ykt.chatQuick3': 'What does the circled part mean?',
      'ykt.chatFailed': 'AI reply failed: {detail}',
      'ykt.chatAnnotation': 'Questions focus on your {n} marks: the AI reads a close-up of each marked area first',
      'ykt.chatNoModel': 'Choose a vision-capable model first',
      'ykt.deadline': 'Due',
      'ykt.leafType.0': 'Video',
      'ykt.leafType.3': 'Recommended',
      'ykt.leafType.4': 'Discussion',
      'ykt.leafType.5': 'Exam/assignment',
      'ykt.leafType.6': 'Assignment',
      'ykt.leafType.8': 'Check-in/class',
      'ykt.leafType.19': 'Chapter assignment',
      'ykt.analysisPrompt': 'Use the ykt tool to analyze the lesson \"{lesson}\" in my Yuketang course \"{course}\" (lessonId={lessonId}, classroomId={classroomId}, courseId={courseId}). Read lesson, slides (attach=true, up to 12 pages), replay, mind_map and progress, then based on the slide images output: 1) a dated study plan by priority with deadlines; 2) a prioritized exam-point list with slide references; 3) create atomic review cards from the exam points with the study tool.',
      'stats.due': 'Due today',
      'stats.streak': 'Day streak',
      'stats.today': 'Reviewed today',
      'stats.total': 'Total cards',
      'stats.mastered': 'Mastered',
      'stats.learning': 'Learning',
      'stats.fresh': 'New cards',
      'stats.unit.card': '',
      'stats.unit.day': 'd',
      'review.start': 'Start today\u2019s review',
      'review.startAll': 'Review all cards',
      'review.emptyTitle': 'Nothing due today',
      'review.emptyBody': 'That is the point of spacing: rest when rest is due. You can still review ahead, or ask DeepSeek to add new cards.',
      'review.doneTitle': 'Review complete',
      'review.doneBody': 'You reviewed {n} cards and kept a {streak}-day streak.',
      'review.againRound': 'Another round',
      'review.progress': 'Card {index} of {total}',
      'review.reveal': 'Show answer',
      'review.hint': 'Space to reveal · 1–4 to grade',
      'review.skip': 'Later',
      'review.again': 'Again',
      'review.hard': 'Hard',
      'review.good': 'Good',
      'review.easy': 'Easy',
      'review.againHint': 'in 10 min',
      'review.hardHint': 'in {n}',
      'review.goodHint': 'in {n}',
      'review.easyHint': 'in {n}',
      'review.front': 'Question',
      'review.back': 'Answer',
      'review.deck': 'Deck',
      'review.noCards': 'No cards yet',
      'library.search': 'Search cards…',
      'library.allDecks': 'All decks',
      'library.add': 'New card',
      'library.newFront': 'Front: one clear question',
      'library.newBack': 'Back: a short, checkable answer',
      'library.newDeck': 'Deck name (optional)',
      'library.defaultDeck': 'Default',
      'library.save': 'Save card',
      'library.cancel': 'Cancel',
      'library.delete': 'Delete',
      'library.confirmDelete': 'Confirm delete',
      'library.edit': 'Edit',
      'library.empty': 'No matching cards',
      'library.count': '{n} cards',
      'library.limit': 'The deck is limited to {n} cards; delete some first.',
      'library.dueNow': 'Due now',
      'library.nextDue': 'Next {when}',
      'library.reps': 'Reviewed {n}×',
      'library.saveEdit': 'Save changes',
      'stats.week': 'Reviews in the last 7 days',
      'stats.mastery': 'Mastery mix',
      'stats.decks': 'Decks',
      'stats.goal': 'Daily goal',
      'stats.goalHint': 'How many cards you plan to review each day',
      'stats.noData': 'No reviews yet',
      'stats.mastery.new': 'New',
      'stats.mastery.learning': 'Learning',
      'stats.mastery.mature': 'Mastered',
      'common.loading': 'Loading study data…',
      'common.offline': 'Study data is unavailable',
      'common.offlineBody': 'Make sure the desktop Harness settings service is running, then retry.',
      'common.retry': 'Retry',
      'common.saveFailed': 'Could not save: {detail}',
      'common.today': 'Today',
      'common.minutes': '{n} min',
      'common.hours': '{n} h',
      'common.days': '{n} d',
      'common.justNow': 'now',
    }

    function formatText(dict, key, params) {
      let text = dict[key] === undefined ? key : dict[key]
      if (params) {
        Object.keys(params).forEach(function (name) {
          text = text.split('{' + name + '}').join(String(params[name]))
        })
      }
      return text
    }

    // ------------------------------------------------------------------
    // Small pure helpers (mirrors of the Host half)
    // ------------------------------------------------------------------
    function pad2(n) {
      return n < 10 ? '0' + n : String(n)
    }

    function dayKey(date) {
      const d = date || new Date()
      return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate())
    }

    function clampText(value, max) {
      const text = String(value == null ? '' : value).trim()
      return text.length > max ? text.slice(0, max) : text
    }

    function isRecord(value) {
      return typeof value === 'object' && value !== null && !Array.isArray(value)
    }

    function normalizeState(raw) {
      if (!isRecord(raw)) return null
      const cards = Array.isArray(raw.cards)
        ? raw.cards
            .filter(function (card) {
              return isRecord(card) && clampText(card.front, 1) && clampText(card.back, 1)
            })
            .map(function (card) {
              return {
                id: String(card.id || ''),
                front: clampText(card.front, MAX_FRONT),
                back: clampText(card.back, MAX_BACK),
                deck: clampText(card.deck, 60) || '默认',
                tags: Array.isArray(card.tags)
                  ? card.tags.map(function (tag) {
                      return clampText(tag, 40)
                    }).filter(Boolean).slice(0, 8)
                  : [],
                createdAt: Number(card.createdAt) || Date.now(),
                due: Number(card.due) || Date.now(),
                interval: Number(card.interval) || 0,
                ease: Math.min(3.2, Math.max(1.3, Number(card.ease) || 2.5)),
                reps: Math.max(0, Number(card.reps) || 0),
                lapses: Math.max(0, Number(card.lapses) || 0),
                lastReview: Number(card.lastReview) || null,
              }
            })
            .filter(function (card) {
              return card.id !== ''
            })
            .slice(0, MAX_CARDS)
        : []
      const daily = {}
      if (isRecord(raw.daily)) {
        Object.keys(raw.daily).forEach(function (key) {
          const value = raw.daily[key]
          if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || !isRecord(value)) return
          daily[key] = {
            reviews: Math.max(0, Number(value.reviews) || 0),
            again: Math.max(0, Number(value.again) || 0),
            hard: Math.max(0, Number(value.hard) || 0),
            good: Math.max(0, Number(value.good) || 0),
            easy: Math.max(0, Number(value.easy) || 0),
          }
        })
      }
      return {
        version: 1,
        createdAt: Number(raw.createdAt) || Date.now(),
        updatedAt: Number(raw.updatedAt) || 0,
        cards: cards,
        daily: daily,
        streak: {
          lastDay: isRecord(raw.streak) && typeof raw.streak.lastDay === 'string' ? raw.streak.lastDay : '',
          days: isRecord(raw.streak) ? Math.max(0, Number(raw.streak.days) || 0) : 0,
        },
      }
    }

    function gradeCard(card, grade, now) {
      let ease = Number(card.ease) || 2.5
      let interval = Number(card.interval) || 0
      let reps = Number(card.reps) || 0
      let lapses = Number(card.lapses) || 0
      let nextDays

      if (grade === 'again') {
        ease = Math.max(1.3, ease - 0.2)
        interval = 0
        reps = 0
        lapses += 1
        nextDays = 10 / 1440
      } else if (grade === 'hard') {
        ease = Math.max(1.3, ease - 0.15)
        reps += 1
        nextDays = interval <= 0 ? 1 : Math.max(1, interval * 1.2)
      } else if (grade === 'good') {
        nextDays = reps === 0 ? 1 : reps === 1 ? 3 : Math.max(1, interval * ease)
        reps += 1
      } else {
        ease = Math.min(3.2, ease + 0.15)
        nextDays = reps === 0 ? 2 : reps === 1 ? 5 : Math.max(1, interval * ease * 1.3)
        reps += 1
      }

      return Object.assign({}, card, {
        ease: Math.round(ease * 100) / 100,
        interval: Math.round(nextDays * 10) / 10,
        reps: reps,
        lapses: lapses,
        due: now + nextDays * DAY_MS,
        lastReview: now,
      })
    }

    function applyReview(state, cardId, grade, now) {
      const card = state.cards.filter(function (item) {
        return item.id === cardId
      })[0]
      if (!card) return null
      const graded = gradeCard(card, grade, now)
      const today = dayKey(new Date(now))
      const daily = Object.assign({}, state.daily)
      const row = Object.assign({ reviews: 0, again: 0, hard: 0, good: 0, easy: 0 }, daily[today] || {})
      row.reviews += 1
      row[grade] = (row[grade] || 0) + 1
      daily[today] = row

      let streak = Object.assign({}, state.streak)
      if (streak.lastDay !== today) {
        const yesterday = dayKey(new Date(now - DAY_MS))
        streak = {
          lastDay: today,
          days: streak.lastDay === yesterday ? (streak.days || 0) + 1 : 1,
        }
      }

      return {
        state: Object.assign({}, state, {
          cards: state.cards.map(function (item) {
            return item.id === cardId ? graded : item
          }),
          daily: daily,
          streak: streak,
          updatedAt: now,
        }),
        card: graded,
      }
    }

    function computeStats(state, dailyGoal) {
      const now = Date.now()
      const today = dayKey(new Date(now))
      const todayRow = state.daily[today] || { reviews: 0 }
      return {
        total: state.cards.length,
        due: state.cards.filter(function (card) {
          return card.due <= now
        }).length,
        reviewedToday: Number(todayRow.reviews) || 0,
        dailyGoal: Math.max(1, Number(dailyGoal) || 15),
        streak: Number(state.streak && state.streak.days) || 0,
        mastered: state.cards.filter(function (card) {
          return card.interval >= 21
        }).length,
        learning: state.cards.filter(function (card) {
          return card.interval > 0 && card.interval < 21
        }).length,
        fresh: state.cards.filter(function (card) {
          return card.interval === 0
        }).length,
      }
    }

    function newCardId() {
      return 'c_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
    }

    function formatInterval(interval, t) {
      if (interval < 1) return t('common.minutes', { n: Math.max(1, Math.round(interval * 24 * 60)) })
      if (interval < 2) return t('common.days', { n: 1 })
      return t('common.days', { n: Math.round(interval) })
    }

    function formatRelative(ts, t) {
      const delta = Number(ts) - Date.now()
      if (!isFinite(delta) || delta <= 0) return t('common.justNow')
      const minutes = Math.round(delta / 60000)
      if (minutes < 60) return t('common.minutes', { n: minutes })
      const hours = Math.round(minutes / 60)
      if (hours < 24) return t('common.hours', { n: hours })
      return t('common.days', { n: Math.round(delta / DAY_MS) })
    }

    // ------------------------------------------------------------------
    // Remote data access
    // ------------------------------------------------------------------
    function remoteOf(ctx) {
      if (!ctx) return null
      const remote = ctx.get('remote')
      const settings = ctx.get('remote.settings')
      if (!remote || typeof remote.$on !== 'function') return null
      if (!settings || typeof settings.describe !== 'function' || typeof settings.update !== 'function') return null
      return { $on: remote.$on.bind(remote), settings: settings }
    }

    function pickNamespace(result) {
      if (!result || !result.ok || !result.value) return null
      const namespaces = result.value.namespaces
      if (!Array.isArray(namespaces)) return null
      for (let i = 0; i < namespaces.length; i++) {
        if (namespaces[i] && namespaces[i].ns === NS) return namespaces[i]
      }
      return null
    }

    function stateFromView(view) {
      if (!view || !view.value || typeof view.value.stateJson !== 'string' || !view.value.stateJson) return null
      try {
        return normalizeState(JSON.parse(view.value.stateJson))
      } catch (error) {
        return null
      }
    }

    /**
     * Apply one mutation to the freshest deck, then write it with the revision
     * the mutation was computed from. `updater(baseState)` must be pure: on a
     * revision conflict the same mutation is replayed onto the newly read deck,
     * so a grade typed in the panel never drops a card added by the agent.
     */
    function commitState(ctx, view, updater, done) {
      const remote = remoteOf(ctx)
      if (!remote) {
        done('offline')
        return
      }
      const attempt = function (baseView) {
        const baseState = stateFromView(baseView)
        const nextState = typeof updater === 'function' ? updater(baseState) : updater
        if (!nextState) {
          done('noop')
          return
        }
        const payload = { stateJson: JSON.stringify(nextState) }
        remote.settings
          .update(NS, payload, baseView && baseView.revision)
          .then(function (result) {
            if (result && result.ok) {
              done(null, result.value)
              return
            }
            const message = result && result.error ? result.error.message : 'update failed'
            if (/revision|conflict/i.test(message)) {
              remote.settings.describe().then(function (again) {
                const latest = pickNamespace(again)
                if (latest) attempt(latest)
                else done(message)
              }).catch(function (error) {
                done(String((error && error.message) || error))
              })
            } else {
              done(message)
            }
          })
          .catch(function (error) {
            done(String((error && error.message) || error))
          })
      }
      attempt(view)
    }

    function commitPatch(ctx, view, patch, done) {
      const remote = remoteOf(ctx)
      if (!remote) {
        done('offline')
        return
      }
      const attempt = function (revision) {
        remote.settings
          .update(NS, patch, revision)
          .then(function (result) {
            if (result && result.ok) {
              done(null, result.value)
              return
            }
            const message = result && result.error ? result.error.message : 'update failed'
            if (/revision|conflict/i.test(message)) {
              remote.settings.describe().then(function (again) {
                const latest = pickNamespace(again)
                if (latest) attempt(latest.revision)
                else done(message)
              }).catch(function (error) {
                done(String((error && error.message) || error))
              })
            } else {
              done(message)
            }
          })
          .catch(function (error) {
            done(String((error && error.message) || error))
          })
      }
      attempt(view && view.revision)
    }

    function useStudyView(ctx) {
      const [view, setView] = React.useState(null)
      const [error, setError] = React.useState('')
      const [loading, setLoading] = React.useState(true)

      const load = React.useCallback(
        function () {
          const remote = remoteOf(ctx)
          if (!remote) {
            setError('offline')
            setLoading(false)
            return
          }
          remote.settings
            .describe()
            .then(function (result) {
              const found = pickNamespace(result)
              if (found) {
                setView(found)
                setError('')
              } else {
                setError('missing')
              }
              setLoading(false)
            })
            .catch(function (cause) {
              setError(String((cause && cause.message) || cause))
              setLoading(false)
            })
        },
        [ctx]
      )

      React.useEffect(
        function () {
          let alive = true
          let timer = null
          let tries = 0
          let off = null
          const subscribe = function (remote) {
            if (off !== null || typeof remote.$on !== 'function') return
            off = remote.$on('settings/document-updated', function (ns) {
              if (ns === NS) load()
            })
          }
          const start = function () {
            if (!alive) return
            const remote = remoteOf(ctx)
            if (!remote) {
              tries += 1
              if (tries < 40) timer = setTimeout(start, 300)
              else setLoading(false)
              return
            }
            subscribe(remote)
            load()
          }
          start()
          return function () {
            alive = false
            if (timer !== null) clearTimeout(timer)
            if (typeof off === 'function') off()
          }
        },
        [ctx, load]
      )

      return { view: view, error: error, loading: loading, reload: load, setView: setView }
    }

    // ------------------------------------------------------------------
    // Icons
    // ------------------------------------------------------------------
    function BookIcon(props) {
      const size = (props && props.size) || 18
      return h(
        'svg',
        {
          width: size,
          height: size,
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.7,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': 'true',
          focusable: 'false',
          style: { display: 'block', flex: 'none' },
        },
        h('path', { d: 'M12 6.2C9.9 4.9 7.2 4.5 4.8 5.3v13.1c2.4-.8 5.1-.4 7.2.9 2.1-1.3 4.8-1.7 7.2-.9V5.3c-2.4-.8-5.1-.4-7.2.9Z' }),
        h('path', { d: 'M12 6.2v13.1' })
      )
    }

    function FlameIcon(props) {
      const size = (props && props.size) || 16
      return h(
        'svg',
        {
          width: size,
          height: size,
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.7,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': 'true',
          focusable: 'false',
          style: { display: 'block', flex: 'none' },
        },
        h('path', { d: 'M12 3c.6 3.3-2.6 4.6-2.6 7.4 0 1.7 1.2 2.6 2.2 2.6.7 0 1.2-.4 1.2-1.1 0-1.6-1.3-2.2-.4-4.3 1.8 1.2 4.6 3.6 4.6 7.1A5.9 5.9 0 0 1 12 21a6 6 0 0 1-6-6.1C6 10.5 10.7 8.4 12 3Z' })
      )
    }

    function CheckIcon(props) {
      const size = (props && props.size) || 18
      return h(
        'svg',
        {
          width: size,
          height: size,
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 2,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': 'true',
          focusable: 'false',
          style: { display: 'block', flex: 'none' },
        },
        h('path', { d: 'M4.5 12.5 9.2 17l10.3-10' })
      )
    }

    function PlusIcon(props) {
      const size = (props && props.size) || 16
      return h(
        'svg',
        {
          width: size,
          height: size,
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 2,
          strokeLinecap: 'round',
          'aria-hidden': 'true',
          focusable: 'false',
          style: { display: 'block', flex: 'none' },
        },
        h('path', { d: 'M12 5v14M5 12h14' })
      )
    }

    function TrashIcon(props) {
      const size = (props && props.size) || 15
      return h(
        'svg',
        {
          width: size,
          height: size,
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.8,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': 'true',
          focusable: 'false',
          style: { display: 'block', flex: 'none' },
        },
        h('path', { d: 'M4 7h16M9 7V4.8c0-.4.3-.8.8-.8h4.4c.5 0 .8.4.8.8V7M6.5 7l.8 12.2c0 .5.4.8.9.8h7.6c.5 0 .9-.3.9-.8L17.5 7' })
      )
    }

    function EditIcon(props) {
      const size = (props && props.size) || 15
      return h(
        'svg',
        {
          width: size,
          height: size,
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.8,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': 'true',
          focusable: 'false',
          style: { display: 'block', flex: 'none' },
        },
        h('path', { d: 'M4 20h4.2L19 9.2a2.3 2.3 0 0 0-3.2-3.2L5 16.8V20Z' }),
        h('path', { d: 'm13.8 7.2 3 3' })
      )
    }

    function RefreshIcon(props) {
      const size = (props && props.size) || 15
      return h(
        'svg',
        {
          width: size,
          height: size,
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.8,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': 'true',
          focusable: 'false',
          style: { display: 'block', flex: 'none' },
        },
        h('path', { d: 'M20 11a8 8 0 1 0-2.3 6.3' }),
        h('path', { d: 'M20 4v7h-7' })
      )
    }

    // ------------------------------------------------------------------
    // Small components
    // ------------------------------------------------------------------
    function StatTile(props) {
      return h(
        'div',
        { className: 'sc-stat', 'data-tone': props.tone || '' },
        h('div', { className: 'sc-stat-label' }, props.label),
        h('div', { className: 'sc-stat-value' }, props.value),
        props.hint ? h('div', { className: 'sc-stat-hint' }, props.hint) : null
      )
    }

    function DeckChip(props) {
      return h('span', { className: 'sc-chip' }, props.name)
    }

    function ProgressBar(props) {
      const value = Math.max(0, Math.min(props.max, props.value))
      const pct = props.max > 0 ? Math.round((value / props.max) * 100) : 0
      return h(
        'div',
        {
          className: 'sc-progress',
          role: 'progressbar',
          'aria-valuenow': value,
          'aria-valuemin': 0,
          'aria-valuemax': props.max,
          'aria-label': props.label || '',
        },
        h('div', { className: 'sc-progress-fill', style: { width: pct + '%' } })
      )
    }

    function LoadingBlock(props) {
      return h(
        'div',
        { className: 'sc-center' },
        h('div', { className: 'sc-spinner', 'aria-hidden': 'true' }),
        h('p', { className: 'sc-muted' }, props.text)
      )
    }

    // ------------------------------------------------------------------
    // Review tab
    // ------------------------------------------------------------------
    function ReviewTab(props) {
      const t = props.t
      const ctx = props.ctx
      const state = props.state
      const view = props.view
      const setView = props.setView
      const stats = computeStats(state, view.value && view.value.dailyGoal)
      const [queue, setQueue] = React.useState(null)
      const [revealed, setRevealed] = React.useState(false)
      const [busy, setBusy] = React.useState(false)
      const [notice, setNotice] = React.useState('')
      const [completed, setCompleted] = React.useState(0)

      const dueNow = React.useMemo(
        function () {
          return state.cards
            .filter(function (card) {
              return card.due <= Date.now()
            })
            .sort(function (a, b) {
              return a.due - b.due
            })
        },
        [state]
      )

      const card =
        queue && queue.length
          ? state.cards.filter(function (item) {
              return item.id === queue[0]
            })[0]
          : null

      const start = function (cards) {
        setCompleted(0)
        setRevealed(false)
        setNotice('')
        setQueue(cards.map(function (item) {
          return item.id
        }))
      }

      const grade = function (gradeKey) {
        if (!card || busy) return
        const now = Date.now()
        const outcome = applyReview(state, card.id, gradeKey, now)
        if (!outcome) return
        setBusy(true)
        commitState(ctx, view, function (base) {
          const replayed = applyReview(base, card.id, gradeKey, now)
          return replayed ? replayed.state : null
        }, function (error, nextView) {
          setBusy(false)
          if (error) {
            setNotice(t('common.saveFailed', { detail: error }))
            return
          }
          if (nextView) setView(nextView)
          setCompleted(function (value) {
            return value + 1
          })
          setQueue(function (items) {
            return items ? items.slice(1) : items
          })
          setRevealed(false)
        })
      }

      React.useEffect(
        function () {
          if (!queue || !queue.length) return undefined
          const onKey = function (event) {
            const tag = event.target && event.target.tagName ? event.target.tagName : ''
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
            if (event.code === 'Space' && !revealed) {
              event.preventDefault()
              setRevealed(true)
              return
            }
            if (revealed && (event.code === 'Digit1' || event.code === 'Digit2' || event.code === 'Digit3' || event.code === 'Digit4')) {
              event.preventDefault()
              grade(['again', 'hard', 'good', 'easy'][Number(event.code.slice(-1)) - 1])
            }
          }
          window.addEventListener('keydown', onKey)
          return function () {
            window.removeEventListener('keydown', onKey)
          }
        },
        [queue, revealed, card, state, view, busy]
      )

      if (!state.cards.length) {
        return h(
          'div',
          { className: 'sc-empty sc-empty-card' },
          h(BookIcon, { size: 44 }),
          h('h3', null, t('review.noCards')),
          h('p', null, t('review.emptyBody')),
          h(
            'button',
            { type: 'button', className: 'sc-btn sc-btn-primary', onClick: props.onGoLibrary },
            t('library.add')
          )
        )
      }

      if (queue === null) {
        if (stats.due === 0) {
          return h(
            'div',
            { className: 'sc-empty sc-empty-card' },
            h('div', { className: 'sc-empty-icon sc-tone-success' }, h(CheckIcon, { size: 26 })),
            h('h3', null, t('review.emptyTitle')),
            h('p', null, t('review.emptyBody')),
            h(
              'div',
              { className: 'sc-empty-actions' },
              h(
                'button',
                { type: 'button', className: 'sc-btn sc-btn-primary', onClick: function () { start(dueNow.length ? dueNow : state.cards) } },
                t('review.startAll')
              )
            )
          )
        }
        return h(
          'div',
          { className: 'sc-start' },
          h('div', { className: 'sc-start-ring' }, h('span', { className: 'sc-start-number' }, stats.due), h('span', { className: 'sc-start-caption' }, t('stats.due'))),
          h('h3', null, t('review.start')),
          h('p', { className: 'sc-muted' }, t('review.hint')),
          h(
            'button',
            { type: 'button', className: 'sc-btn sc-btn-primary sc-btn-lg', onClick: function () { start(dueNow) } },
            t('review.start')
          )
        )
      }

      if (!queue.length) {
        return h(
          'div',
          { className: 'sc-empty sc-empty-card' },
          h('div', { className: 'sc-empty-icon sc-tone-success' }, h(CheckIcon, { size: 26 })),
          h('h3', null, t('review.doneTitle')),
          h('p', null, t('review.doneBody', { n: completed, streak: computeStats(state, view.value && view.value.dailyGoal).streak })),
          h(
            'div',
            { className: 'sc-empty-actions' },
            h(
              'button',
              { type: 'button', className: 'sc-btn sc-btn-primary', onClick: function () { start(state.cards) } },
              t('review.againRound')
            ),
            h(
              'button',
              { type: 'button', className: 'sc-btn', onClick: function () { setQueue(null); setRevealed(false) } },
              t('library.cancel')
            )
          )
        )
      }

      if (!card) {
        return h(
          'div',
          { className: 'sc-empty sc-empty-card' },
          h('p', null, t('review.noCards')),
          h('button', { type: 'button', className: 'sc-btn', onClick: function () { setQueue(null) } }, t('review.start'))
        )
      }

      const total = completed + queue.length
      const index = completed + 1
      const grades = [
        { key: 'again', label: t('review.again'), hint: t('review.againHint'), tone: 'again' },
        { key: 'hard', label: t('review.hard'), hint: t('review.hardHint', { n: formatInterval(gradeCard(card, 'hard', Date.now()).interval, t) }), tone: 'hard' },
        { key: 'good', label: t('review.good'), hint: t('review.goodHint', { n: formatInterval(gradeCard(card, 'good', Date.now()).interval, t) }), tone: 'good' },
        { key: 'easy', label: t('review.easy'), hint: t('review.easyHint', { n: formatInterval(gradeCard(card, 'easy', Date.now()).interval, t) }), tone: 'easy' },
      ]

      return h(
        'div',
        { className: 'sc-review' },
        h(
          'div',
          { className: 'sc-review-head' },
          h('span', { className: 'sc-muted' }, t('review.progress', { index: index, total: total })),
          h(DeckChip, { name: card.deck })
        ),
        h(ProgressBar, { value: completed, max: total, label: t('review.progress', { index: index, total: total }) }),
        h(
          'div',
          { className: 'sc-flashcard', 'data-revealed': revealed ? '1' : '0' },
          h('div', { className: 'sc-flashcard-label' }, t('review.front')),
          h('div', { className: 'sc-flashcard-front' }, card.front),
          revealed
            ? h(
                'div',
                { className: 'sc-flashcard-back' },
                h('div', { className: 'sc-flashcard-label' }, t('review.back')),
                h('div', { className: 'sc-flashcard-answer' }, card.back),
                card.tags && card.tags.length
                  ? h(
                      'div',
                      { className: 'sc-tagrow' },
                      card.tags.map(function (tag) {
                        return h('span', { className: 'sc-tag', key: tag }, tag)
                      })
                    )
                  : null
              )
            : null
        ),
        notice ? h('div', { className: 'sc-alert', role: 'alert' }, notice) : null,
        revealed
          ? h(
              'div',
              { className: 'sc-grade-grid' },
              grades.map(function (item) {
                return h(
                  'button',
                  {
                    key: item.key,
                    type: 'button',
                    className: 'sc-grade',
                    'data-tone': item.tone,
                    disabled: busy,
                    onClick: function () { grade(item.key) },
                  },
                  h('span', { className: 'sc-grade-label' }, item.label),
                  h('span', { className: 'sc-grade-hint' }, item.hint)
                )
              })
            )
          : h(
              'div',
              { className: 'sc-reveal-row' },
              h(
                'button',
                { type: 'button', className: 'sc-btn sc-btn-primary sc-btn-lg', onClick: function () { setRevealed(true) } },
                t('review.reveal')
              ),
              h('span', { className: 'sc-kbd-hint' }, t('review.hint'))
            ),
        h(
          'div',
          { className: 'sc-review-foot' },
          h(
            'button',
            {
              type: 'button',
              className: 'sc-linkbtn',
              onClick: function () {
                setQueue(function (items) {
                  if (!items || items.length < 2) return items
                  return items.slice(1).concat([items[0]])
                })
                setRevealed(false)
              },
            },
            t('review.skip')
          )
        )
      )
    }

    // ------------------------------------------------------------------
    // Library tab
    // ------------------------------------------------------------------
    function LibraryTab(props) {
      const t = props.t
      const ctx = props.ctx
      const state = props.state
      const view = props.view
      const setView = props.setView
      const [query, setQuery] = React.useState('')
      const [deck, setDeck] = React.useState('')
      const [adding, setAdding] = React.useState(false)
      const [draft, setDraft] = React.useState({ front: '', back: '', deck: '' })
      const [editing, setEditing] = React.useState(null)
      const [pendingDelete, setPendingDelete] = React.useState('')
      const [busy, setBusy] = React.useState(false)
      const [notice, setNotice] = React.useState('')

      const decks = React.useMemo(
        function () {
          const seen = {}
          const list = []
          state.cards.forEach(function (card) {
            if (!seen[card.deck]) {
              seen[card.deck] = true
              list.push(card.deck)
            }
          })
          return list.sort()
        },
        [state]
      )

      const filtered = state.cards.filter(function (card) {
        if (deck && card.deck !== deck) return false
        if (!query.trim()) return true
        const needle = query.trim().toLowerCase()
        return (
          card.front.toLowerCase().indexOf(needle) >= 0 ||
          card.back.toLowerCase().indexOf(needle) >= 0 ||
          card.tags.some(function (tag) { return tag.toLowerCase().indexOf(needle) >= 0 })
        )
      })

      const commit = function (updater, onSuccess) {
        setBusy(true)
        commitState(ctx, view, updater, function (error, nextView) {
          setBusy(false)
          if (error) {
            setNotice(t('common.saveFailed', { detail: error }))
            return
          }
          setNotice('')
          if (nextView) setView(nextView)
          if (onSuccess) onSuccess()
        })
      }

      const addCard = function () {
        const front = clampText(draft.front, MAX_FRONT)
        const back = clampText(draft.back, MAX_BACK)
        if (!front || !back) return
        if (state.cards.length >= MAX_CARDS) {
          setNotice(t('library.limit', { n: MAX_CARDS }))
          return
        }
        const now = Date.now()
        const card = {
          id: newCardId(),
          front: front,
          back: back,
          deck: clampText(draft.deck, 60) || DEFAULT_DECK,
          tags: [],
          createdAt: now,
          due: now,
          interval: 0,
          ease: 2.5,
          reps: 0,
          lapses: 0,
          lastReview: null,
        }
        commit(function (base) {
          return Object.assign({}, base, { cards: base.cards.concat([card]) })
        }, function () {
          setDraft({ front: '', back: '', deck: '' })
          setAdding(false)
        })
      }

      const saveEdit = function () {
        if (!editing) return
        const front = clampText(editing.front, MAX_FRONT)
        const back = clampText(editing.back, MAX_BACK)
        if (!front || !back) return
        commit(function (base) {
          return Object.assign({}, base, {
            cards: base.cards.map(function (card) {
              if (card.id !== editing.id) return card
              return Object.assign({}, card, {
                front: front,
                back: back,
                deck: clampText(editing.deck, 60) || card.deck,
              })
            }),
          })
        }, function () {
          setEditing(null)
        })
      }

      const removeCard = function (cardId) {
        if (pendingDelete !== cardId) {
          setPendingDelete(cardId)
          return
        }
        setPendingDelete('')
        commit(function (base) {
          return Object.assign({}, base, {
            cards: base.cards.filter(function (card) {
              return card.id !== cardId
            }),
          })
        }, null)
      }

      return h(
        'div',
        { className: 'sc-library' },
        h(
          'div',
          { className: 'sc-toolbar' },
          h('input', {
            className: 'sc-input sc-search',
            type: 'search',
            value: query,
            placeholder: t('library.search'),
            onChange: function (event) { setQuery(event.target.value) },
            'aria-label': t('library.search'),
          }),
          h(
            'select',
            {
              className: 'sc-input sc-select',
              value: deck,
              onChange: function (event) { setDeck(event.target.value) },
              'aria-label': t('library.allDecks'),
            },
            h('option', { value: '' }, t('library.allDecks')),
            decks.map(function (name) {
              return h('option', { key: name, value: name }, name)
            })
          ),
          h(
            'button',
            { type: 'button', className: 'sc-btn sc-btn-primary', onClick: function () { setAdding(!adding) } },
            h(PlusIcon),
            t('library.add')
          )
        ),
        notice ? h('div', { className: 'sc-alert', role: 'alert' }, notice) : null,
        adding
          ? h(
              'div',
              { className: 'sc-form' },
              h('textarea', {
                className: 'sc-input sc-textarea',
                rows: 2,
                value: draft.front,
                placeholder: t('library.newFront'),
                onChange: function (event) { setDraft(Object.assign({}, draft, { front: event.target.value })) },
              }),
              h('textarea', {
                className: 'sc-input sc-textarea',
                rows: 3,
                value: draft.back,
                placeholder: t('library.newBack'),
                onChange: function (event) { setDraft(Object.assign({}, draft, { back: event.target.value })) },
              }),
              h('input', {
                className: 'sc-input',
                value: draft.deck,
                placeholder: t('library.newDeck'),
                onChange: function (event) { setDraft(Object.assign({}, draft, { deck: event.target.value })) },
              }),
              h(
                'div',
                { className: 'sc-form-actions' },
                h('button', { type: 'button', className: 'sc-btn sc-btn-primary', disabled: busy, onClick: addCard }, t('library.save')),
                h('button', { type: 'button', className: 'sc-btn', onClick: function () { setAdding(false) } }, t('library.cancel'))
              )
            )
          : null,
        h('div', { className: 'sc-listmeta' }, t('library.count', { n: filtered.length })),
        filtered.length === 0
          ? h('div', { className: 'sc-empty' }, h('p', { className: 'sc-muted' }, t('library.empty')))
          : h(
              'div',
              { className: 'sc-cardlist' },
              filtered.map(function (card) {
                const isEditing = editing && editing.id === card.id
                return h(
                  'div',
                  { className: 'sc-row', key: card.id, 'data-editing': isEditing ? '1' : '0' },
                  isEditing
                    ? h(
                        'div',
                        { className: 'sc-row-edit' },
                        h('textarea', {
                          className: 'sc-input sc-textarea',
                          rows: 2,
                          value: editing.front,
                          onChange: function (event) { setEditing(Object.assign({}, editing, { front: event.target.value })) },
                        }),
                        h('textarea', {
                          className: 'sc-input sc-textarea',
                          rows: 3,
                          value: editing.back,
                          onChange: function (event) { setEditing(Object.assign({}, editing, { back: event.target.value })) },
                        }),
                        h('input', {
                          className: 'sc-input',
                          value: editing.deck,
                          onChange: function (event) { setEditing(Object.assign({}, editing, { deck: event.target.value })) },
                        }),
                        h(
                          'div',
                          { className: 'sc-form-actions' },
                          h('button', { type: 'button', className: 'sc-btn sc-btn-primary', disabled: busy, onClick: saveEdit }, t('library.saveEdit')),
                          h('button', { type: 'button', className: 'sc-btn', onClick: function () { setEditing(null) } }, t('library.cancel'))
                        )
                      )
                    : h(
                        React.Fragment,
                        null,
                        h(
                          'div',
                          { className: 'sc-row-main' },
                          h('div', { className: 'sc-row-front' }, card.front),
                          h('div', { className: 'sc-row-back' }, card.back),
                          h(
                            'div',
                            { className: 'sc-row-meta' },
                            h(DeckChip, { name: card.deck }),
                            h(
                              'span',
                              { className: 'sc-row-due', 'data-due': card.due <= Date.now() ? '1' : '0' },
                              card.due <= Date.now() ? t('library.dueNow') : t('library.nextDue', { when: formatRelative(card.due, t) })
                            ),
                            h('span', null, t('library.reps', { n: card.reps || 0 }))
                          )
                        ),
                        h(
                          'div',
                          { className: 'sc-row-actions' },
                          h(
                            'button',
                            {
                              type: 'button',
                              className: 'sc-iconbtn',
                              title: t('library.edit'),
                              'aria-label': t('library.edit'),
                              onClick: function () {
                                setEditing({ id: card.id, front: card.front, back: card.back, deck: card.deck })
                                setPendingDelete('')
                              },
                            },
                            h(EditIcon)
                          ),
                          h(
                            'button',
                            {
                              type: 'button',
                              className: 'sc-iconbtn sc-danger',
                              title: pendingDelete === card.id ? t('library.confirmDelete') : t('library.delete'),
                              'aria-label': pendingDelete === card.id ? t('library.confirmDelete') : t('library.delete'),
                              'data-confirm': pendingDelete === card.id ? '1' : '0',
                              onClick: function () { removeCard(card.id) },
                              onBlur: function () { setPendingDelete('') },
                            },
                            pendingDelete === card.id ? h('span', { className: 'sc-confirm-text' }, t('library.confirmDelete')) : h(TrashIcon)
                          )
                        )
                      )
                )
              })
            )
      )
    }

    // ------------------------------------------------------------------
    // Stats tab
    // ------------------------------------------------------------------
    function StatsTab(props) {
      const t = props.t
      const ctx = props.ctx
      const state = props.state
      const view = props.view
      const setView = props.setView
      const stats = computeStats(state, view.value && view.value.dailyGoal)
      const [busy, setBusy] = React.useState(false)
      const [notice, setNotice] = React.useState('')

      const week = React.useMemo(
        function () {
          const days = []
          for (let offset = 6; offset >= 0; offset -= 1) {
            const date = new Date(Date.now() - offset * DAY_MS)
            const key = dayKey(date)
            const row = state.daily[key] || { reviews: 0 }
            days.push({
              key: key,
              label: offset === 0 ? t('common.today') : String(date.getMonth() + 1) + '/' + String(date.getDate()),
              reviews: Number(row.reviews) || 0,
            })
          }
          return days
        },
        [state, t]
      )
      const weekMax = Math.max.apply(null, week.map(function (day) { return day.reviews }).concat([1]))

      const decks = React.useMemo(
        function () {
          const map = {}
          state.cards.forEach(function (card) {
            if (!map[card.deck]) map[card.deck] = { total: 0, due: 0, mastered: 0 }
            map[card.deck].total += 1
            if (card.due <= Date.now()) map[card.deck].due += 1
            if (card.interval >= 21) map[card.deck].mastered += 1
          })
          return Object.keys(map).map(function (name) {
            return Object.assign({ name: name }, map[name])
          }).sort(function (a, b) { return b.total - a.total })
        },
        [state]
      )

      const setGoal = function (goal) {
        setBusy(true)
        commitPatch(ctx, view, { dailyGoal: goal }, function (error, nextView) {
          setBusy(false)
          if (error) {
            setNotice(t('common.saveFailed', { detail: error }))
            return
          }
          setNotice('')
          if (nextView) setView(nextView)
        })
      }

      const masteryRows = [
        { key: 'new', label: t('stats.mastery.new'), value: stats.fresh, tone: 'new' },
        { key: 'learning', label: t('stats.mastery.learning'), value: stats.learning, tone: 'learning' },
        { key: 'mature', label: t('stats.mastery.mature'), value: stats.mastered, tone: 'mature' },
      ]
      const totalForMastery = Math.max(1, stats.total)

      return h(
        'div',
        { className: 'sc-stats' },
        notice ? h('div', { className: 'sc-alert', role: 'alert' }, notice) : null,
        h(
          'div',
          { className: 'sc-stat-grid' },
          h(StatTile, { label: t('stats.due'), value: String(stats.due), hint: t('stats.unit.card') }),
          h(StatTile, { label: t('stats.streak'), value: String(stats.streak), hint: t('stats.unit.day'), tone: 'warm' }),
          h(StatTile, { label: t('stats.today'), value: stats.reviewedToday + '/' + stats.dailyGoal }),
          h(StatTile, { label: t('stats.total'), value: String(stats.total) })
        ),
        h(
          'section',
          { className: 'sc-card' },
          h('h3', { className: 'sc-card-title' }, t('stats.week')),
          week.every(function (day) { return day.reviews === 0 })
            ? h('p', { className: 'sc-muted' }, t('stats.noData'))
            : h(
                'div',
                { className: 'sc-bars' },
                week.map(function (day) {
                  return h(
                    'div',
                    { className: 'sc-bar-col', key: day.key },
                    h('div', { className: 'sc-bar-wrap' },
                      h('div', {
                        className: 'sc-bar',
                        style: { height: Math.max(4, Math.round((day.reviews / weekMax) * 100)) + '%' },
                        title: day.reviews + ' · ' + day.label,
                      }),
                      h('span', { className: 'sc-bar-value' }, String(day.reviews))
                    ),
                    h('span', { className: 'sc-bar-label' }, day.label)
                  )
                })
              )
        ),
        h(
          'section',
          { className: 'sc-card' },
          h('h3', { className: 'sc-card-title' }, t('stats.mastery')),
          h(
            'div',
            { className: 'sc-mastery' },
            masteryRows.map(function (row) {
              return h(
                'div',
                { className: 'sc-mastery-row', key: row.key },
                h('span', { className: 'sc-mastery-label' }, row.label),
                h(
                  'div',
                  { className: 'sc-mastery-track' },
                  h('div', {
                    className: 'sc-mastery-fill',
                    'data-tone': row.tone,
                    style: { width: Math.round((row.value / totalForMastery) * 100) + '%' },
                  })
                ),
                h('span', { className: 'sc-mastery-value' }, String(row.value))
              )
            })
          )
        ),
        h(
          'section',
          { className: 'sc-card' },
          h('h3', { className: 'sc-card-title' }, t('stats.decks')),
          decks.length === 0
            ? h('p', { className: 'sc-muted' }, t('stats.noData'))
            : h(
                'div',
                { className: 'sc-decklist' },
                decks.map(function (item) {
                  return h(
                    'div',
                    { className: 'sc-deckrow', key: item.name },
                    h(DeckChip, { name: item.name }),
                    h('span', { className: 'sc-deckrow-count' }, item.total + ' · ' + t('stats.due') + ' ' + item.due + ' · ' + t('stats.mastered') + ' ' + item.mastered)
                  )
                })
              )
        ),
        h(
          'section',
          { className: 'sc-card' },
          h('h3', { className: 'sc-card-title' }, t('stats.goal')),
          h('p', { className: 'sc-hint' }, t('stats.goalHint')),
          h(
            'div',
            { className: 'sc-goalrow' },
            [10, 15, 20, 30, 50].map(function (goal) {
              return h(
                'button',
                {
                  key: goal,
                  type: 'button',
                  className: 'sc-goalbtn',
                  'data-active': stats.dailyGoal === goal ? '1' : '0',
                  disabled: busy,
                  onClick: function () { setGoal(goal) },
                },
                String(goal)
              )
            })
          )
        )
      )
    }

    // ------------------------------------------------------------------
    // Yuketang tab
    // ------------------------------------------------------------------
    const YKT_REGIONS = ['standard', 'hetang', 'changjiang', 'huanghe']

    async function yktFetch(path, options) {
      const init = Object.assign({ method: 'GET' }, options || {})
      const headers = Object.assign({ 'x-dsh-ykt-bridge': '1' }, (options && options.headers) || {})
      if (init.body !== undefined && typeof init.body !== 'string') {
        init.body = JSON.stringify(init.body)
        headers['content-type'] = 'application/json'
      }
      init.headers = headers
      const response = await fetch('/api/local/dsh-ykt-study/' + path, init)
      const payload = await response.json().catch(function () { return null })
      if (!response.ok) {
        throw new Error(payload && payload.error && payload.error.message ? payload.error.message : path + ' HTTP ' + response.status)
      }
      if (!payload || payload.ok !== true) {
        throw new Error(payload && payload.error && payload.error.message ? payload.error.message : '雨课堂接口返回异常')
      }
      return payload.data
    }

    function isAllowedSlideUrl(value) {
      try {
        const url = new URL(String(value))
        if (url.protocol !== 'https:') return false
        return /(^|\.)yuketang\.cn$/i.test(url.hostname)
      } catch (error) {
        return false
      }
    }

    function slideImageUrl(cover) {
      if (!cover) return ''
      const value = String(cover)
      const absolute = /^\/\//.test(value) ? 'https:' + value : /^https?:\/\//i.test(value) ? value : 'https://qn-scd1.yuketang.cn/' + value.replace(/^\/+/, '')
      const httpsUrl = absolute.replace(/^http:\/\//i, 'https://')
      return isAllowedSlideUrl(httpsUrl) ? httpsUrl : ''
    }

    function copyText(text) {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        return navigator.clipboard.writeText(text)
      }
      return new Promise(function (resolve, reject) {
        try {
          const area = document.createElement('textarea')
          area.value = text
          area.style.position = 'fixed'
          area.style.opacity = '0'
          document.body.appendChild(area)
          area.select()
          document.execCommand('copy')
          document.body.removeChild(area)
          resolve()
        } catch (error) {
          reject(error)
        }
      })
    }

    function YktModelPicker(props) {
      const t = props.t
      const models = props.models
      const override = models && models.override
      const value = override ? override.provider + '::' + override.model : ''
      const options = [h('option', { key: '__default__', value: '' }, t('ykt.modelDefault') + (models && !models.override && models.effective && models.effective.model ? ' · ' + models.effective.model : ''))]
      if (models && Array.isArray(models.providers)) {
        models.providers.forEach(function (provider) {
          if (!provider || !Array.isArray(provider.models) || !provider.models.length) return
          const items = provider.models.map(function (model) {
            const textOnly = Array.isArray(model.inputModalities) && model.inputModalities.length > 0 && model.vision === false
            return h('option', { key: provider.id + '::' + model.id, value: provider.id + '::' + model.id }, (model.name || model.id) + (textOnly ? ' · ' + t('ykt.modelTextOnly') : ''))
          })
          options.push(h('optgroup', { key: provider.id, label: provider.name || provider.id }, items))
        })
      }
      const currentMissing =
        override &&
        !(models && Array.isArray(models.providers) && models.providers.some(function (provider) {
          return provider.id === override.provider && provider.models.some(function (model) { return model.id === override.model })
        }))
      if (currentMissing) {
        options.push(h('option', { key: '__current__', value: value }, override.model))
      }
      return h(
        'div',
        { className: 'sc-ykt-modelp', title: (models && models.error) || t('ykt.modelHint') },
        h('span', { className: 'sc-ykt-modelp-label' }, t('ykt.model')),
        h(
          'select',
          {
            className: 'sc-select sc-ykt-modelp-select',
            value: value,
            disabled: props.busy === true || !models,
            onChange: function (event) {
              const raw = event.target.value
              if (!raw) {
                props.onSave(null)
                return
              }
              const split = raw.indexOf('::')
              if (split < 0) return
              props.onSave({ provider: raw.slice(0, split), model: raw.slice(split + 2) })
            },
          },
          options
        ),
        models && models.error ? h('span', { className: 'sc-ykt-modelp-error', title: models.error }, '!') : null
      )
    }

    function summaryMarkdown(summary) {
      if (!summary) return ''
      const lines = ['# ' + (summary.title || '知识点总结')]
      const meta = summary.meta || {}
      if (meta.courseName) lines.push('课程：' + meta.courseName)
      if (meta.title) lines.push('课时：' + meta.title)
      if (summary.overview) lines.push('', summary.overview)
      const kps = Array.isArray(summary.knowledgePoints) ? summary.knowledgePoints : []
      if (kps.length) {
        lines.push('', '## 核心知识点')
        kps.forEach(function (point, index) {
          const badge = point.importance === 'high' ? '【重点】' : point.importance === 'low' ? '【了解】' : '【掌握】'
          lines.push(index + 1 + '. ' + badge + point.name + (point.page ? '（第 ' + point.page + ' 页）' : ''))
          if (point.detail) lines.push('   ' + point.detail)
        })
      }
      const exams = Array.isArray(summary.examPoints) ? summary.examPoints : []
      if (exams.length) {
        lines.push('', '## 考点清单')
        exams.forEach(function (point, index) {
          lines.push(index + 1 + '. ' + point.name)
          if (point.why) lines.push('   为什么考：' + point.why)
          if (point.how) lines.push('   怎么答：' + point.how)
        })
      }
      const pitfalls = Array.isArray(summary.pitfalls) ? summary.pitfalls : []
      if (pitfalls.length) {
        lines.push('', '## 易错点 / 易混点')
        pitfalls.forEach(function (item) { lines.push('- ' + item) })
      }
      const plan = Array.isArray(summary.studyPlan) ? summary.studyPlan : []
      if (plan.length) {
        lines.push('', '## 复习计划')
        plan.forEach(function (step) {
          lines.push('### ' + step.title)
          const steps = Array.isArray(step.steps) ? step.steps : []
          steps.forEach(function (item) { lines.push('- ' + item) })
        })
      }
      return lines.join('\n')
    }

    function YktSummaryView(props) {
      const t = props.t
      const summary = props.summary || {}
      const meta = summary.meta || {}
      const kps = Array.isArray(summary.knowledgePoints) ? summary.knowledgePoints : []
      const exams = Array.isArray(summary.examPoints) ? summary.examPoints : []
      const pitfalls = Array.isArray(summary.pitfalls) ? summary.pitfalls : []
      const plan = Array.isArray(summary.studyPlan) ? summary.studyPlan : []
      const warnings = Array.isArray(meta.warnings) ? meta.warnings : []
      const importance = function (level) { return t('ykt.importance.' + (level === 'high' || level === 'low' ? level : 'medium')) }
      return h(
        'section',
        { className: 'sc-ykt-summary' },
        h(
          'div',
          { className: 'sc-ykt-summary-head' },
          h(
            'div',
            { className: 'sc-ykt-summary-heading' },
            h('h4', { className: 'sc-ykt-summary-title' }, summary.title || t('ykt.summary')),
            h(
              'p',
              { className: 'sc-ykt-summary-meta' },
              [meta.courseName, meta.truncated ? t('ykt.summaryTruncated', { read: meta.slideCount, total: meta.declaredSlideCount }) : (meta.slideCount ? t('ykt.summarySlides', { n: meta.slideCount }) : ''), meta.model && meta.model.model ? t('ykt.summaryModel', { name: meta.model.model }) : '', props.cached ? t('ykt.summaryCached') : ''].filter(Boolean).join(' · ')
            )
          ),
          h(
            'div',
            { className: 'sc-ykt-summary-actions' },
            h('button', { type: 'button', className: 'sc-btn', onClick: props.onCopy }, t('ykt.summaryCopy')),
            h('button', { type: 'button', className: 'sc-btn sc-btn-primary', disabled: props.busyCards, onClick: props.onCards }, props.busyCards ? t('ykt.working') : t('ykt.summaryCards')),
            h('button', { type: 'button', className: 'sc-btn', onClick: props.onRegenerate }, t('ykt.summaryAgain'))
          )
        ),
        summary.overview ? h('p', { className: 'sc-ykt-summary-overview' }, summary.overview) : null,
        meta.warnings && warnings.length ? h('p', { className: 'sc-ykt-warn', title: warnings.join('\n') }, t('ykt.summaryWarning', { n: warnings.length })) : null,
        kps.length
          ? h(
              'div',
              { className: 'sc-ykt-summary-section' },
              h('h5', { className: 'sc-ykt-summary-subtitle' }, t('ykt.knowledgePoints')),
              h(
                'ol',
                { className: 'sc-ykt-kp' },
                kps.map(function (point, index) {
                  return h(
                    'li',
                    { className: 'sc-ykt-kp-item', key: index },
                    h(
                      'div',
                      { className: 'sc-ykt-kp-head' },
                      h('span', { className: 'sc-ykt-imp', 'data-level': point.importance || 'medium' }, importance(point.importance)),
                      h('span', { className: 'sc-ykt-kp-name' }, point.name),
                      point.page ? h('span', { className: 'sc-ykt-kp-page' }, t('ykt.pageN', { n: point.page })) : null
                    ),
                    point.detail ? h('p', { className: 'sc-ykt-kp-detail' }, renderInlineLines(point.detail, 'kp')) : null
                  )
                })
              )
            )
          : null,
        exams.length
          ? h(
              'div',
              { className: 'sc-ykt-summary-section' },
              h('h5', { className: 'sc-ykt-summary-subtitle' }, t('ykt.examPoints')),
              h(
                'ol',
                { className: 'sc-ykt-exam' },
                exams.map(function (point, index) {
                  return h(
                    'li',
                    { className: 'sc-ykt-exam-item', key: index },
                    h('div', { className: 'sc-ykt-exam-name' }, point.name),
                    point.why ? h('p', { className: 'sc-ykt-exam-line' }, point.why) : null,
                    point.how ? h('p', { className: 'sc-ykt-exam-line sc-ykt-exam-how' }, point.how) : null
                  )
                })
              )
            )
          : null,
        pitfalls.length
          ? h(
              'div',
              { className: 'sc-ykt-summary-section' },
              h('h5', { className: 'sc-ykt-summary-subtitle' }, t('ykt.pitfalls')),
              h('ul', { className: 'sc-ykt-pitfalls' }, pitfalls.map(function (item, index) { return h('li', { key: index }, item) }))
            )
          : null,
        plan.length
          ? h(
              'div',
              { className: 'sc-ykt-summary-section' },
              h('h5', { className: 'sc-ykt-summary-subtitle' }, t('ykt.studyPlan')),
              h(
                'div',
                { className: 'sc-ykt-plan' },
                plan.map(function (step, index) {
                  const steps = Array.isArray(step.steps) ? step.steps : []
                  return h(
                    'div',
                    { className: 'sc-ykt-plan-step', key: index },
                    h('div', { className: 'sc-ykt-plan-title' }, step.title || ''),
                    steps.length ? h('ul', { className: 'sc-ykt-plan-list' }, steps.map(function (item, i) { return h('li', { key: i }, item) })) : null
                  )
                })
              )
            )
          : null
      )
    }

    function YktSummaryProgress(props) {
      const t = props.t
      const job = props.job || {}
      const phase = job.phase && t('ykt.summaryPhase.' + job.phase) !== 'ykt.summaryPhase.' + job.phase ? t('ykt.summaryPhase.' + job.phase) : job.message || t('ykt.summaryPhase.prepare')
      const pct = Math.max(3, Math.min(100, Math.round((Number(job.progress) || 0) * 100)))
      return h(
        'section',
        { className: 'sc-ykt-summary sc-ykt-summary-progress' },
        h(
          'div',
          { className: 'sc-ykt-summary-head' },
          h('div', { className: 'sc-ykt-summary-heading' }, h('h4', { className: 'sc-ykt-summary-title' }, t('ykt.summary')), h('p', { className: 'sc-ykt-summary-meta' }, phase)),
          h('button', { type: 'button', className: 'sc-btn', onClick: props.onCancel }, t('ykt.summaryCancel'))
        ),
        h('div', { className: 'sc-progress' }, h('div', { className: 'sc-progress-fill', style: { width: pct + '%' } })),
        h('p', { className: 'sc-ykt-summary-progress-text' }, t('ykt.summaryRunning', { done: job.readSlides || 0, total: job.totalSlides || '—' }))
      )
    }

    // ------------------------------------------------------------------
    // Knowledge board (pegboard of AI-grown knowledge trees)
    // ------------------------------------------------------------------
    function bySeq(left, right) { return (Number(left.seq) || 0) - (Number(right.seq) || 0) }

    const BOARD_ASK_PRESETS = ['explain', 'example', 'relation', 'exam']

    /** Path labels from the tree root down to (not including) `node`. */
    function boardPath(nodesById, node) {
      const path = []
      let current = node && node.parent ? nodesById[node.parent] : null
      let guard = 0
      while (current && guard < 64) {
        path.unshift(current.label)
        current = current.parent ? nodesById[current.parent] : null
        guard += 1
      }
      return path
    }

    /** Right-click menu for one knowledge point; portalled so no ancestor clips it. */
    function YktBoardMenu(props) {
      const t = props.t
      const menuRef = React.useRef(null)
      const node = props.node
      const close = props.onClose

      React.useEffect(function () {
        const menu = menuRef.current
        const first = menu && menu.querySelector('button')
        if (first) first.focus()
        const onDown = function (event) {
          if (menuRef.current && !menuRef.current.contains(event.target)) close()
        }
        const onKey = function (event) {
          if (event.key === 'Escape') { event.preventDefault(); close(); return }
          if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
          const items = menuRef.current ? Array.prototype.slice.call(menuRef.current.querySelectorAll('button')) : []
          if (!items.length) return
          event.preventDefault()
          const at = items.indexOf(document.activeElement)
          const next = event.key === 'ArrowDown' ? (at + 1) % items.length : (at - 1 + items.length) % items.length
          items[next].focus()
        }
        const onAway = function () { close() }
        window.addEventListener('mousedown', onDown, true)
        window.addEventListener('keydown', onKey, true)
        window.addEventListener('resize', onAway)
        window.addEventListener('blur', onAway)
        document.addEventListener('scroll', onAway, true)
        return function () {
          window.removeEventListener('mousedown', onDown, true)
          window.removeEventListener('keydown', onKey, true)
          window.removeEventListener('resize', onAway)
          window.removeEventListener('blur', onAway)
          document.removeEventListener('scroll', onAway, true)
        }
      }, [close])

      const pages = Array.isArray(node.pages) ? node.pages : []
      const itemCount = BOARD_ASK_PRESETS.length + 2 + (pages.length ? 1 : 0)
      const width = 232
      const height = itemCount * 32 + 46
      const viewW = typeof window !== 'undefined' ? window.innerWidth : 1024
      const viewH = typeof window !== 'undefined' ? window.innerHeight : 768
      const left = Math.max(8, Math.min(props.x, viewW - width - 8))
      const top = Math.max(8, Math.min(props.y, viewH - height - 8))
      const pick = function (fn) { return function () { close(); fn() } }

      const menu = h(
        'div',
        { ref: menuRef, className: 'sc-kb-menu', role: 'menu', 'aria-label': t('ykt.boardAskMenu'), style: { left: left + 'px', top: top + 'px', width: width + 'px' }, onContextMenu: function (event) { event.preventDefault() } },
        h('div', { className: 'sc-kb-menu-title' }, node.label),
        BOARD_ASK_PRESETS.map(function (id) {
          return h('button', { key: id, type: 'button', role: 'menuitem', className: 'sc-kb-menu-item', onClick: pick(function () { props.onAsk(t('ykt.boardAsk.' + id)) }) }, t('ykt.boardAsk.' + id))
        }),
        h('button', { type: 'button', role: 'menuitem', className: 'sc-kb-menu-item', onClick: pick(props.onCustom) }, t('ykt.boardAsk.custom')),
        h('div', { className: 'sc-kb-menu-sep', role: 'separator' }),
        pages.length
          ? h('button', { type: 'button', role: 'menuitem', className: 'sc-kb-menu-item sc-kb-menu-minor', onClick: pick(function () { props.onOpenPage(pages[0]) }) }, t('ykt.boardOpenPage', { n: pages[0] }))
          : null,
        h('button', { type: 'button', role: 'menuitem', className: 'sc-kb-menu-item sc-kb-menu-minor', onClick: pick(props.onCopy) }, t('ykt.boardAsk.copy'))
      )
      if (ReactDOM && typeof ReactDOM.createPortal === 'function' && typeof document !== 'undefined' && document.body) {
        return ReactDOM.createPortal(menu, document.body)
      }
      return menu
    }

    function YktKnowledgeBoard(props) {
      const t = props.t
      const board = props.board && typeof props.board === 'object' ? props.board : null
      const [collapsed, setCollapsed] = React.useState({})
      const [selected, setSelected] = React.useState('')
      const [tall, setTall] = React.useState(false)
      const [menu, setMenu] = React.useState(null)
      const [chatNodeId, setChatNodeId] = React.useState('')
      const [chats, setChats] = React.useState({})
      const savedBoardRef = React.useRef({})
      const [draft, setDraft] = React.useState('')
      const [sending, setSending] = React.useState('')
      const [chatError, setChatError] = React.useState('')
      const [copied, setCopied] = React.useState('')
      React.useEffect(
        function () {
          const saved = props.savedChats && typeof props.savedChats === 'object' ? props.savedChats : {}
          savedBoardRef.current = Object.assign({}, saved)
          setChats(function (prev) { return Object.assign({}, saved, prev) })
        },
        [props.savedChats]
      )
      React.useEffect(
        function () {
          if (!props.chatResetEpoch) return
          savedBoardRef.current = {}
          setChats({})
        },
        [props.chatResetEpoch]
      )
      React.useEffect(
        function () {
          if (props.lessonId) persistChangedChats(props.lessonId, 'board', savedBoardRef.current, chats)
        },
        [chats]
      )
      const inputRef = React.useRef(null)
      const listRef = React.useRef(null)
      const focusInput = React.useRef(false)
      const closeMenu = React.useCallback(function () { setMenu(null) }, [])

      const trees = board && Array.isArray(board.trees) ? board.trees.slice().sort(bySeq) : []
      const nodesById = board && board.nodes && typeof board.nodes === 'object' ? board.nodes : {}
      const nodes = Object.keys(nodesById).map(function (id) { return nodesById[id] })
      const children = {}
      nodes.slice().sort(bySeq).forEach(function (node) {
        const key = node.tree + '|' + (node.parent || '')
        if (!children[key]) children[key] = []
        children[key].push(node)
      })
      const kidsOf = function (node) { return children[node.tree + '|' + node.id] || [] }
      const chatNode = chatNodeId ? nodesById[chatNodeId] || null : null
      const chatMessages = chatNodeId && Array.isArray(chats[chatNodeId]) ? chats[chatNodeId] : []

      React.useEffect(function () {
        if (focusInput.current && inputRef.current) {
          focusInput.current = false
          inputRef.current.focus()
        }
        if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
      }, [chatNodeId, chatMessages.length, sending])

      if (!trees.length) {
        if (!props.live && !props.missing) return null
        return h(
          'section',
          { className: 'sc-kb', 'data-empty': '1' },
          h('div', { className: 'sc-kb-head' }, h('h4', { className: 'sc-kb-title' }, t('ykt.board')), props.live ? h('span', { className: 'sc-kb-live' }, t('ykt.boardLive')) : null),
          h('div', { className: 'sc-kb-pegboard sc-kb-pegboard-empty' }, h('p', { className: 'sc-kb-empty' }, props.live ? t('ykt.boardWaiting') : t('ykt.boardMissing')))
        )
      }

      const openPage = function (page) { if (props.onOpenPage) props.onOpenPage(page) }

      const ask = function (node, question) {
        const text = String(question || '').trim()
        if (!node || !text || sending) return
        const nodeId = node.id
        const history = Array.isArray(chats[nodeId]) ? chats[nodeId] : []
        setChatNodeId(nodeId)
        setChatError('')
        setDraft('')
        setChats(function (prev) {
          const next = Object.assign({}, prev)
          next[nodeId] = (Array.isArray(prev[nodeId]) ? prev[nodeId] : []).concat([{ role: 'user', text: text }])
          return next
        })
        setSending(nodeId)
        const tree = trees.filter(function (item) { return item.id === node.tree })[0]
        const siblings = (children[node.tree + '|' + (node.parent || '')] || []).filter(function (item) { return item.id !== nodeId })
        yktFetch('board-chat', {
          method: 'POST',
          body: {
            lessonId: props.lessonId || '',
            presentationId: props.presentationId || '',
            courseName: props.courseName || '',
            lessonTitle: props.lessonTitle || '',
            treeTitle: tree ? tree.title : '',
            node: { id: node.id, label: node.label, detail: node.detail || '', pages: node.pages || [], importance: node.importance || 'medium' },
            path: boardPath(nodesById, node),
            children: kidsOf(node).map(function (item) { return item.label }),
            siblings: siblings.map(function (item) { return item.label }),
            question: text,
            history: history.slice(-8),
          },
        })
          .then(function (data) {
            setChats(function (prev) {
              const next = Object.assign({}, prev)
              next[nodeId] = (Array.isArray(prev[nodeId]) ? prev[nodeId] : []).concat([{ role: 'assistant', text: (data && data.answer) || '' }])
              return next
            })
          })
          .catch(function (cause) {
            setChatError(t('ykt.chatFailed', { detail: (cause && cause.message) || String(cause) }))
          })
          .finally(function () { setSending('') })
      }

      const openChat = function (node, focus) {
        setChatNodeId(node.id)
        setChatError('')
        if (focus) focusInput.current = true
      }

      const copyNode = function (node) {
        const pages = Array.isArray(node.pages) && node.pages.length ? '（课件第 ' + node.pages.join('、') + ' 页）' : ''
        copyText(node.label + (node.detail ? '：' + node.detail : '') + pages)
          .then(function () { setCopied(node.id); setTimeout(function () { setCopied('') }, 1500) })
          .catch(function () {})
      }

      const renderNode = function (node) {
        const kids = kidsOf(node)
        const isCollapsed = collapsed[node.id] === true
        const isSelected = selected === node.id
        const pages = Array.isArray(node.pages) ? node.pages : []
        return h(
          'li',
          { key: node.id, className: 'sc-kb-item' },
          h(
            'div',
            { className: 'sc-kb-row' },
            kids.length
              ? h('button', {
                  type: 'button',
                  className: 'sc-kb-toggle',
                  'aria-expanded': isCollapsed ? 'false' : 'true',
                  'aria-label': isCollapsed ? t('ykt.boardExpand') : t('ykt.boardCollapse'),
                  onClick: function () {
                    setCollapsed(function (prev) { const next = Object.assign({}, prev); next[node.id] = !isCollapsed; return next })
                  },
                }, isCollapsed ? '▸' : '▾')
              : h('span', { className: 'sc-kb-toggle sc-kb-toggle-leaf', 'aria-hidden': 'true' }, '•'),
            h('button', {
              type: 'button',
              className: 'sc-kb-node',
              'data-imp': node.importance || 'medium',
              'data-fresh': props.live && board.lastNodeId === node.id ? '1' : '0',
              'data-selected': isSelected ? '1' : '0',
              'data-asking': chatNodeId === node.id ? '1' : '0',
              'aria-haspopup': 'menu',
              title: (node.detail ? node.detail + '\n' : '') + t('ykt.boardAskHint'),
              onClick: function () { setSelected(isSelected ? '' : node.id) },
              onContextMenu: function (event) {
                event.preventDefault()
                let x = event.clientX
                let y = event.clientY
                // Keyboard context-menu key reports (0,0): anchor on the node instead.
                if ((!x && !y) && event.currentTarget && event.currentTarget.getBoundingClientRect) {
                  const rect = event.currentTarget.getBoundingClientRect()
                  x = rect.left + 12
                  y = rect.bottom + 4
                }
                setMenu({ x: x, y: y, nodeId: node.id })
              },
            },
              h('span', { className: 'sc-kb-label' }, node.label),
              isCollapsed && kids.length ? h('span', { className: 'sc-kb-count' }, '+' + kids.length) : null,
              pages.length ? h('span', { className: 'sc-kb-pages' }, 'p' + pages.join(',')) : null,
              Array.isArray(chats[node.id]) && chats[node.id].length ? h('span', { className: 'sc-kb-asked', 'aria-hidden': 'true' }, '💬') : null)
          ),
          isSelected
            ? h('div', { className: 'sc-kb-detail' },
                node.detail ? h('p', null, renderInlineLines(node.detail, 'kb')) : null,
                h('div', { className: 'sc-kb-detail-meta' },
                  h('span', { className: 'sc-kb-imp', 'data-imp': node.importance || 'medium' }, t('ykt.importance.' + (node.importance === 'high' || node.importance === 'low' ? node.importance : 'medium'))),
                  pages.map(function (page) {
                    return h('button', { key: page, type: 'button', className: 'sc-ykt-chip sc-kb-page', title: t('ykt.boardOpenPage', { n: page }), onClick: function () { openPage(page) } }, t('ykt.boardPage', { n: page }))
                  }),
                  h('button', { type: 'button', className: 'sc-ykt-chip sc-kb-page sc-kb-askbtn', onClick: function () { openChat(node, true) } }, t('ykt.boardAsk'))))
            : null,
          kids.length && !isCollapsed ? h('ul', { className: 'sc-kb-children' }, kids.map(renderNode)) : null
        )
      }

      const collapseAll = function () {
        const next = {}
        nodes.forEach(function (node) { if (kidsOf(node).length) next[node.id] = true })
        setCollapsed(next)
      }

      const menuNode = menu ? nodesById[menu.nodeId] : null
      const chatPath = chatNode ? boardPath(nodesById, chatNode) : []

      return h(
        'section',
        { className: 'sc-kb', 'data-tall': tall ? '1' : '0' },
        h(
          'div',
          { className: 'sc-kb-head' },
          h('h4', { className: 'sc-kb-title' }, t('ykt.board')),
          h('span', { className: 'sc-kb-stats' }, t('ykt.boardStats', { trees: trees.length, nodes: nodes.length })),
          props.live ? h('span', { className: 'sc-kb-live' }, t('ykt.boardLive')) : h('span', { className: 'sc-kb-tip' }, t('ykt.boardAskHint')),
          h('span', { className: 'sc-kb-spacer' }),
          h('button', { type: 'button', className: 'sc-linkbtn', onClick: function () { setCollapsed({}) } }, t('ykt.boardExpandAll')),
          h('button', { type: 'button', className: 'sc-linkbtn', onClick: collapseAll }, t('ykt.boardCollapseAll')),
          h('button', { type: 'button', className: 'sc-linkbtn', onClick: function () { setTall(!tall) } }, tall ? t('ykt.boardShorter') : t('ykt.boardTaller'))
        ),
        h(
          'div',
          { className: 'sc-kb-body' },
          h(
            'div',
            { className: 'sc-kb-pegboard' },
            trees.map(function (tree) {
              const roots = children[tree.id + '|'] || []
              const count = nodes.filter(function (node) { return node.tree === tree.id }).length
              return h(
                'article',
                { key: tree.id, className: 'sc-kb-tree' },
                h('header', { className: 'sc-kb-tree-head' },
                  h('strong', null, tree.title),
                  h('span', { className: 'sc-kb-tree-count' }, String(count))),
                roots.length ? h('ul', { className: 'sc-kb-roots' }, roots.map(renderNode)) : h('p', { className: 'sc-kb-empty' }, t('ykt.boardGrowing'))
              )
            })
          ),
          chatNode
            ? h(
                'aside',
                { className: 'sc-kb-chat', 'aria-label': t('ykt.boardChatTitle', { label: chatNode.label }) },
                h('div', { className: 'sc-kb-chat-head' },
                  h('div', { className: 'sc-kb-chat-heading' },
                    h('strong', null, t('ykt.boardChatTitle', { label: chatNode.label })),
                    chatPath.length ? h('span', { className: 'sc-kb-chat-path' }, chatPath.concat([chatNode.label]).join(' › ')) : null),
                  h('div', { className: 'sc-kb-chat-tools' },
                    chatMessages.length
                      ? h('button', { type: 'button', className: 'sc-linkbtn', onClick: function () {
                          const id = chatNode.id
                          setChats(function (prev) { const next = Object.assign({}, prev); next[id] = []; return next })
                        } }, t('ykt.chatClear'))
                      : null,
                    h('button', { type: 'button', className: 'sc-iconbtn', 'aria-label': t('ykt.boardChatClose'), title: t('ykt.boardChatClose'), onClick: function () { setChatNodeId(''); setChatError('') } }, '✕'))),
                h('div', { className: 'sc-ykt-chat-list sc-kb-chat-list', ref: listRef },
                  chatMessages.length
                    ? chatMessages.map(function (message, index) {
                        return h('div', { key: index, className: 'sc-ykt-msg', 'data-role': message.role }, chatBubble(message))
                      })
                    : h('p', { className: 'sc-ykt-chat-empty' }, t('ykt.boardChatEmpty')),
                  sending === chatNode.id ? h('div', { className: 'sc-ykt-chat-thinking' }, t('ykt.chatThinking')) : null),
                chatError ? h('div', { className: 'sc-alert', role: 'alert' }, chatError) : null,
                h('div', { className: 'sc-ykt-chat-quick' },
                  BOARD_ASK_PRESETS.map(function (id) {
                    return h('button', { key: id, type: 'button', className: 'sc-ykt-chip', disabled: !!sending, onClick: function () { ask(chatNode, t('ykt.boardAsk.' + id)) } }, t('ykt.boardAskShort.' + id))
                  })),
                h('div', { className: 'sc-ykt-chat-input' },
                  h('textarea', {
                    ref: inputRef,
                    className: 'sc-input sc-textarea sc-ykt-chat-textarea',
                    value: draft,
                    placeholder: t('ykt.boardChatPlaceholder', { label: chatNode.label }),
                    onChange: function (event) { setDraft(event.target.value) },
                    onKeyDown: function (event) {
                      if (event.key === 'Enter' && !event.shiftKey && !(event.nativeEvent && event.nativeEvent.isComposing)) {
                        event.preventDefault()
                        ask(chatNode, draft)
                      }
                    },
                  }),
                  h('button', { type: 'button', className: 'sc-btn sc-btn-primary', disabled: !!sending || !draft.trim(), onClick: function () { ask(chatNode, draft) } }, sending ? t('ykt.working') : t('ykt.chatSend')))
              )
            : null
        ),
        copied ? h('div', { className: 'sc-ykt-ok sc-kb-copied', role: 'status' }, t('ykt.boardCopied')) : null,
        menuNode
          ? h(YktBoardMenu, {
              t: t,
              node: menuNode,
              x: menu.x,
              y: menu.y,
              onClose: closeMenu,
              onAsk: function (question) { ask(menuNode, question) },
              onCustom: function () { openChat(menuNode, true) },
              onOpenPage: openPage,
              onCopy: function () { copyNode(menuNode) },
            })
          : null
      )
    }

    function clamp01(value) {
      const number = Number(value)
      if (!Number.isFinite(number)) return 0
      return Math.max(0, Math.min(1, number))
    }

    function drawAnnotationStroke(ctx, stroke, width, height) {
      if (!stroke || !Array.isArray(stroke.points) || !stroke.points.length) return
      ctx.save()
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      if (stroke.tool === 'highlight') {
        ctx.globalAlpha = 0.34
        ctx.strokeStyle = stroke.color || '#ffd54f'
        ctx.lineWidth = Math.max(8, width * 0.014)
      } else {
        ctx.globalAlpha = 0.95
        ctx.strokeStyle = stroke.color || '#ef4444'
        ctx.lineWidth = Math.max(2, width * 0.0035)
      }
      ctx.beginPath()
      stroke.points.forEach(function (point, index) {
        const x = clamp01(point[0]) * width
        const y = clamp01(point[1]) * height
        if (index === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      })
      ctx.stroke()
      if (stroke.points.length === 1) {
        const point = stroke.points[0]
        ctx.beginPath()
        ctx.arc(clamp01(point[0]) * width, clamp01(point[1]) * height, Math.max(2, ctx.lineWidth / 2), 0, Math.PI * 2)
        ctx.fillStyle = ctx.strokeStyle
        ctx.fill()
      }
      ctx.restore()
    }

    function buildOverlayDataUrl(strokes, naturalWidth, naturalHeight) {
      if (!Array.isArray(strokes) || !strokes.length || !naturalWidth || !naturalHeight) return ''
      if (typeof document === 'undefined') return ''
      try {
        const scale = Math.min(1, 1600 / naturalWidth)
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round(naturalWidth * scale))
        canvas.height = Math.max(1, Math.round(naturalHeight * scale))
        const ctx = canvas.getContext('2d')
        if (!ctx) return ''
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        strokes.forEach(function (stroke) { drawAnnotationStroke(ctx, stroke, canvas.width, canvas.height) })
        return canvas.toDataURL('image/png')
      } catch (error) {
        return ''
      }
    }

    // ---- Annotation focus: crop what the student circled -----------------
    // The model used to receive the whole slide plus a separate transparent
    // stroke layer, so it skimmed the page instead of the marked spot. We now
    // composite the strokes onto the page and cut a close-up of every marked
    // region; those crops are sent first and carry the question.
    const slideDataUrlCache = new Map()

    function fetchSlideDataUrl(lessonId, presentationId, slideIndex) {
      const cacheKey = presentationId + ':' + slideIndex
      if (slideDataUrlCache.has(cacheKey)) return slideDataUrlCache.get(cacheKey)
      const pending = yktFetch('slide-image', {
        method: 'POST',
        body: { lessonId: lessonId, presentationId: presentationId, slideIndex: slideIndex },
      }).then(function (data) {
        if (!data || !data.dataUrl) throw new Error('slide-image empty')
        return data.dataUrl
      })
      pending.catch(function () { slideDataUrlCache.delete(cacheKey) })
      slideDataUrlCache.set(cacheKey, pending)
      if (slideDataUrlCache.size > 12) slideDataUrlCache.delete(slideDataUrlCache.keys().next().value)
      return pending
    }

    function loadImageElement(src) {
      return new Promise(function (resolve, reject) {
        const image = new Image()
        image.onload = function () { resolve(image) }
        image.onerror = function () { reject(new Error('image decode failed')) }
        image.src = src
      })
    }

    function strokeBounds(stroke) {
      const points = stroke && Array.isArray(stroke.points) ? stroke.points : []
      if (!points.length) return null
      let x0 = 1
      let y0 = 1
      let x1 = 0
      let y1 = 0
      points.forEach(function (point) {
        const x = clamp01(point[0])
        const y = clamp01(point[1])
        if (x < x0) x0 = x
        if (x > x1) x1 = x
        if (y < y0) y0 = y
        if (y > y1) y1 = y
      })
      // Highlighter strokes are thick bands; give them vertical room.
      const pad = stroke.tool === 'highlight' ? 0.02 : 0.008
      return { x0: x0 - pad, y0: y0 - pad, x1: x1 + pad, y1: y1 + pad }
    }

    /** Group strokes into at most three marked regions (normalised 0–1 boxes). */
    function annotationRegions(strokes) {
      const near = 0.05
      let boxes = (Array.isArray(strokes) ? strokes : []).map(strokeBounds).filter(Boolean)
      let merged = true
      while (merged && boxes.length > 1) {
        merged = false
        outer: for (let i = 0; i < boxes.length; i += 1) {
          for (let j = i + 1; j < boxes.length; j += 1) {
            const a = boxes[i]
            const b = boxes[j]
            if (a.x0 - near <= b.x1 && b.x0 - near <= a.x1 && a.y0 - near <= b.y1 && b.y0 - near <= a.y1) {
              boxes[i] = { x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) }
              boxes.splice(j, 1)
              merged = true
              break outer
            }
          }
        }
      }
      boxes.sort(function (a, b) { return (b.x1 - b.x0) * (b.y1 - b.y0) - (a.x1 - a.x0) * (a.y1 - a.y0) })
      if (boxes.length > 3) {
        // Too many separate marks: fold the rest into the third region.
        const rest = boxes.slice(2)
        boxes = boxes.slice(0, 2).concat([rest.reduce(function (acc, box) {
          return { x0: Math.min(acc.x0, box.x0), y0: Math.min(acc.y0, box.y0), x1: Math.max(acc.x1, box.x1), y1: Math.max(acc.y1, box.y1) }
        })])
      }
      return boxes
        .map(function (box) {
          // Context margin around the mark, and a minimum size so a tiny
          // circle still shows the surrounding line of text or formula.
          let x0 = box.x0 - 0.06
          let x1 = box.x1 + 0.06
          let y0 = box.y0 - 0.05
          let y1 = box.y1 + 0.05
          const minW = 0.3
          const minH = 0.2
          if (x1 - x0 < minW) { const cx = (x0 + x1) / 2; x0 = cx - minW / 2; x1 = cx + minW / 2 }
          if (y1 - y0 < minH) { const cy = (y0 + y1) / 2; y0 = cy - minH / 2; y1 = cy + minH / 2 }
          if (x0 < 0) { x1 -= x0; x0 = 0 }
          if (y0 < 0) { y1 -= y0; y0 = 0 }
          if (x1 > 1) { x0 -= x1 - 1; x1 = 1 }
          if (y1 > 1) { y0 -= y1 - 1; y1 = 1 }
          return { x0: Math.max(0, x0), y0: Math.max(0, y0), x1: Math.min(1, x1), y1: Math.min(1, y1) }
        })
        .sort(function (a, b) { return a.y0 - b.y0 || a.x0 - b.x0 })
    }

    /**
     * Resolve to { marked, focus: [{ image, box }] } — the full page with the
     * strokes burnt in, and a close-up crop of each marked region.
     */
    function buildAnnotationImages(strokes, slideDataUrl) {
      return loadImageElement(slideDataUrl).then(function (image) {
        const naturalW = image.naturalWidth || image.width
        const naturalH = image.naturalHeight || image.height
        if (!naturalW || !naturalH) throw new Error('empty slide image')
        const base = Math.min(1, 2400 / Math.max(naturalW, naturalH))
        const page = document.createElement('canvas')
        page.width = Math.max(1, Math.round(naturalW * base))
        page.height = Math.max(1, Math.round(naturalH * base))
        const pctx = page.getContext('2d')
        if (!pctx) throw new Error('canvas unavailable')
        pctx.fillStyle = '#ffffff'
        pctx.fillRect(0, 0, page.width, page.height)
        pctx.drawImage(image, 0, 0, page.width, page.height)
        strokes.forEach(function (stroke) { drawAnnotationStroke(pctx, stroke, page.width, page.height) })

        const markedScale = Math.min(1, 1600 / page.width)
        const marked = document.createElement('canvas')
        marked.width = Math.max(1, Math.round(page.width * markedScale))
        marked.height = Math.max(1, Math.round(page.height * markedScale))
        marked.getContext('2d').drawImage(page, 0, 0, marked.width, marked.height)

        const focus = annotationRegions(strokes).map(function (box) {
          const sx = Math.round(box.x0 * page.width)
          const sy = Math.round(box.y0 * page.height)
          const sw = Math.max(1, Math.round((box.x1 - box.x0) * page.width))
          const sh = Math.max(1, Math.round((box.y1 - box.y0) * page.height))
          // Upscale small regions (up to 2.5x) so fine print stays legible.
          const scale = Math.min(2.5, 1280 / Math.max(sw, sh))
          const crop = document.createElement('canvas')
          crop.width = Math.max(1, Math.round(sw * scale))
          crop.height = Math.max(1, Math.round(sh * scale))
          const cctx = crop.getContext('2d')
          cctx.imageSmoothingQuality = 'high'
          cctx.drawImage(page, sx, sy, sw, sh, 0, 0, crop.width, crop.height)
          return { image: crop.toDataURL('image/jpeg', 0.92), box: box }
        })
        return { marked: marked.toDataURL('image/jpeg', 0.88), focus: focus }
      })
    }

    // ---- Rich answers: Markdown + LaTeX rendered as native MathML ----------
    // AI answers arrive as Markdown with TeX math (\( \), \[ \], $ $, $$ $$).
    // They used to be shown verbatim; this small renderer turns the common
    // Markdown blocks into elements and converts TeX to MathML, which the
    // desktop shell's Chromium draws natively — no fonts or CDN needed.
    // Anything the converter does not understand degrades to readable text.
    const TEX_GREEK = {
      alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ϵ', varepsilon: 'ε', zeta: 'ζ', eta: 'η',
      theta: 'θ', vartheta: 'ϑ', iota: 'ι', kappa: 'κ', lambda: 'λ', mu: 'μ', nu: 'ν', xi: 'ξ', omicron: 'ο',
      pi: 'π', varpi: 'ϖ', rho: 'ρ', varrho: 'ϱ', sigma: 'σ', varsigma: 'ς', tau: 'τ', upsilon: 'υ',
      phi: 'ϕ', varphi: 'φ', chi: 'χ', psi: 'ψ', omega: 'ω',
      Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ', Xi: 'Ξ', Pi: 'Π', Sigma: 'Σ', Upsilon: 'Υ',
      Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω',
    }
    const TEX_IDENT = { infty: '∞', partial: '∂', nabla: '∇', emptyset: '∅', varnothing: '∅', hbar: 'ℏ', ell: 'ℓ', aleph: 'ℵ', Re: 'ℜ', Im: 'ℑ', imath: 'ı', jmath: 'ȷ' }
    const TEX_OPS = {
      times: '×', cdot: '⋅', div: '÷', pm: '±', mp: '∓', ast: '∗', star: '⋆', circ: '∘', bullet: '∙',
      leq: '≤', le: '≤', geq: '≥', ge: '≥', neq: '≠', ne: '≠', approx: '≈', equiv: '≡', sim: '∼', simeq: '≃',
      cong: '≅', propto: '∝', ll: '≪', gg: '≫', in: '∈', notin: '∉', ni: '∋', subset: '⊂', subseteq: '⊆',
      supset: '⊃', supseteq: '⊇', cup: '∪', cap: '∩', setminus: '∖', forall: '∀', exists: '∃', neg: '¬',
      lnot: '¬', land: '∧', wedge: '∧', lor: '∨', vee: '∨', to: '→', rightarrow: '→', leftarrow: '←',
      gets: '←', Rightarrow: '⇒', Leftarrow: '⇐', Leftrightarrow: '⇔', leftrightarrow: '↔', iff: '⟺',
      implies: '⟹', mapsto: '↦', longrightarrow: '⟶', uparrow: '↑', downarrow: '↓',
      ldots: '…', cdots: '⋯', vdots: '⋮', ddots: '⋱', dots: '…', mid: '∣', parallel: '∥', perp: '⊥',
      angle: '∠', langle: '⟨', rangle: '⟩', lfloor: '⌊', rfloor: '⌋', lceil: '⌈', rceil: '⌉',
      lvert: '|', rvert: '|', vert: '|', lVert: '‖', rVert: '‖', Vert: '‖', prime: '′', triangle: '△',
      odot: '⊙', oplus: '⊕', otimes: '⊗', top: '⊤', bot: '⊥', colon: ':', backslash: '∖',
    }
    const TEX_BIG_OPS = { sum: '∑', prod: '∏', coprod: '∐', int: '∫', iint: '∬', iiint: '∭', oint: '∮', bigcup: '⋃', bigcap: '⋂', bigoplus: '⨁', bigotimes: '⨂' }
    const TEX_FUNCS = ['sin', 'cos', 'tan', 'cot', 'sec', 'csc', 'arcsin', 'arccos', 'arctan', 'sinh', 'cosh', 'tanh', 'log', 'ln', 'lg', 'exp', 'det', 'dim', 'ker', 'arg', 'deg', 'gcd', 'Pr', 'hom']
    const TEX_LIMIT_FUNCS = ['lim', 'max', 'min', 'sup', 'inf', 'limsup', 'liminf', 'argmax', 'argmin']
    const TEX_SPACES = { ',': '0.167em', ':': '0.222em', '>': '0.222em', ';': '0.278em', ' ': '0.25em', quad: '1em', qquad: '2em', enspace: '0.5em', thinspace: '0.167em' }
    const TEX_ACCENTS = { hat: '^', widehat: '^', bar: '¯', overline: '¯', vec: '→', overrightarrow: '→', tilde: '~', widetilde: '~', dot: '˙', ddot: '¨', check: 'ˇ', breve: '˘' }
    const TEX_BB = { R: 'ℝ', N: 'ℕ', Z: 'ℤ', Q: 'ℚ', C: 'ℂ', P: 'ℙ', H: 'ℍ', E: '𝔼', 1: '𝟙' }

    function escapeXml(value) {
      return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    }

    function texTokens(src) {
      const out = []
      let i = 0
      while (i < src.length && out.length < 6000) {
        const c = src[i]
        if (c === '\\') {
          const word = /^\\([a-zA-Z]+)\*?/.exec(src.slice(i, i + 40))
          if (word) { out.push({ t: 'cmd', v: word[1] }); i += word[0].length; continue }
          out.push({ t: 'cmd', v: src[i + 1] || '' })
          i += 2
          continue
        }
        if (/\s/.test(c)) { out.push({ t: 'sp', v: ' ' }); i += 1; continue }
        if (/[0-9]/.test(c)) {
          const num = /^[0-9]+(?:\.[0-9]+)?/.exec(src.slice(i))[0]
          out.push({ t: 'num', v: num })
          i += num.length
          continue
        }
        out.push({ t: 'ch', v: c })
        i += 1
      }
      return out
    }

    /** Convert one TeX expression to a MathML string. Throws on hard failures. */
    function texToMathML(src, display) {
      const toks = texTokens(String(src || ''))
      let pos = 0
      let lastBigOp = false
      const skip = function () { while (pos < toks.length && toks[pos].t === 'sp') pos += 1 }
      const peek = function () { skip(); return toks[pos] }
      const next = function () { skip(); return toks[pos++] }
      const isCh = function (tok, v) { return !!tok && tok.t === 'ch' && tok.v === v }
      const isCmd = function (tok, v) { return !!tok && tok.t === 'cmd' && tok.v === v }
      const mrow = function (items) { return '<mrow>' + items.join('') + '</mrow>' }
      const tokText = function (tok) {
        if (tok.t === 'cmd') return /^[a-zA-Z]+$/.test(tok.v) ? '\\' + tok.v : (tok.v === ',' || tok.v === ' ' ? ' ' : tok.v)
        return tok.v
      }
      const rawArg = function () {
        skip()
        const tok = toks[pos]
        if (!tok) return ''
        if (!isCh(tok, '{')) { pos += 1; return tokText(tok) }
        pos += 1
        let depth = 1
        let out = ''
        while (pos < toks.length) {
          const t = toks[pos++]
          if (isCh(t, '{')) depth += 1
          if (isCh(t, '}')) {
            depth -= 1
            if (!depth) break
          }
          out += tokText(t)
        }
        return out
      }
      const parseRow = function (stop) {
        const items = []
        let guard = 0
        while (guard++ < 6000) {
          const tok = peek()
          if (!tok || (stop && stop(tok))) break
          items.push(parseScripted())
        }
        return items
      }
      const groupArg = function () {
        const tok = peek()
        if (!tok) return '<mrow></mrow>'
        if (isCh(tok, '{')) {
          next()
          const items = parseRow(function (t) { return isCh(t, '}') })
          if (peek()) next()
          return mrow(items)
        }
        return mrow([parseAtom()])
      }
      const delimiter = function (tok) {
        if (!tok) return ''
        if (tok.t === 'ch') return tok.v === '.' ? '' : tok.v
        if (tok.v === '{' || tok.v === '}') return tok.v
        if (tok.v === '|') return '‖'
        return TEX_OPS[tok.v] || ''
      }
      const environment = function (name) {
        if (name === 'array') rawArg()
        const rows = [[]]
        let cell = []
        let guard = 0
        while (guard++ < 6000) {
          const tok = peek()
          if (!tok) break
          if (isCmd(tok, 'end')) { next(); rawArg(); break }
          if (isCmd(tok, '\\')) { next(); rows[rows.length - 1].push(cell); cell = []; rows.push([]); continue }
          if (isCh(tok, '&')) { next(); rows[rows.length - 1].push(cell); cell = []; continue }
          cell.push(parseScripted())
        }
        rows[rows.length - 1].push(cell)
        const filled = rows.filter(function (row) { return row.some(function (c) { return c.length }) })
        const aligned = name === 'aligned' || name === 'align' || name === 'cases' || name === 'split' || name === 'gathered'
        const table = '<mtable' + (aligned ? ' columnalign="' + (name === 'cases' ? 'left left' : 'right left') + '"' : '') + '>' +
          filled.map(function (row) {
            return '<mtr>' + row.map(function (c) { return '<mtd>' + mrow(c) + '</mtd>' }).join('') + '</mtr>'
          }).join('') + '</mtable>'
        const fences = { pmatrix: ['(', ')'], bmatrix: ['[', ']'], Bmatrix: ['{', '}'], vmatrix: ['|', '|'], Vmatrix: ['‖', '‖'], cases: ['{', ''] }[name]
        if (!fences) return table
        return '<mrow><mo stretchy="true">' + escapeXml(fences[0]) + '</mo>' + table + (fences[1] ? '<mo stretchy="true">' + escapeXml(fences[1]) + '</mo>' : '') + '</mrow>'
      }
      const parseCommand = function (name) {
        if (name === 'frac' || name === 'dfrac' || name === 'tfrac' || name === 'cfrac') return '<mfrac>' + groupArg() + groupArg() + '</mfrac>'
        if (name === 'binom' || name === 'dbinom' || name === 'tbinom') return '<mrow><mo>(</mo><mfrac linethickness="0">' + groupArg() + groupArg() + '</mfrac><mo>)</mo></mrow>'
        if (name === 'sqrt') {
          if (isCh(peek(), '[')) {
            next()
            const index = parseRow(function (t) { return isCh(t, ']') })
            if (peek()) next()
            const base = groupArg()
            return '<mroot>' + base + mrow(index) + '</mroot>'
          }
          return '<msqrt>' + groupArg() + '</msqrt>'
        }
        if (name === 'left') {
          const open = delimiter(next())
          const inner = parseRow(function (t) { return isCmd(t, 'right') })
          let close = ''
          if (isCmd(peek(), 'right')) { next(); close = delimiter(next()) }
          return '<mrow>' + (open ? '<mo stretchy="true">' + escapeXml(open) + '</mo>' : '') + inner.join('') + (close ? '<mo stretchy="true">' + escapeXml(close) + '</mo>' : '') + '</mrow>'
        }
        if (name === 'right' || name === 'middle') { const d = delimiter(next()); return d ? '<mo stretchy="true">' + escapeXml(d) + '</mo>' : '' }
        if (/^(big|Big|bigg|Bigg)(l|r|m)?$/.test(name)) { const d = delimiter(next()); return d ? '<mo>' + escapeXml(d) + '</mo>' : '' }
        if (name === 'text' || name === 'mbox' || name === 'textrm' || name === 'textup' || name === 'textnormal') return '<mtext>' + escapeXml(rawArg()) + '</mtext>'
        if (name === 'textbf') return '<mtext style="font-weight:bold">' + escapeXml(rawArg()) + '</mtext>'
        if (name === 'textit' || name === 'emph') return '<mtext style="font-style:italic">' + escapeXml(rawArg()) + '</mtext>'
        if (name === 'mathrm' || name === 'operatorname' || name === 'mathup' || name === 'rm') {
          const value = rawArg().replace(/\\,|\\ /g, ' ').trim()
          return '<mi mathvariant="normal">' + escapeXml(value) + '</mi>'
        }
        if (name === 'mathbf' || name === 'boldsymbol' || name === 'bm' || name === 'bf') return '<mrow style="font-weight:bold">' + groupArg() + '</mrow>'
        if (name === 'mathit') return groupArg()
        if (name === 'mathbb' || name === 'Bbb') {
          const value = rawArg()
          return '<mi mathvariant="normal">' + escapeXml(value.split('').map(function (ch) { return TEX_BB[ch] || ch }).join('')) + '</mi>'
        }
        if (name === 'mathcal' || name === 'mathscr' || name === 'mathfrak' || name === 'mathsf' || name === 'mathtt') return '<mi>' + escapeXml(rawArg()) + '</mi>'
        if (TEX_ACCENTS[name]) return '<mover accent="true">' + groupArg() + '<mo stretchy="' + (/^(widehat|widetilde|overline|overrightarrow)$/.test(name) ? 'true' : 'false') + '">' + TEX_ACCENTS[name] + '</mo></mover>'
        if (name === 'underline') return '<munder accentunder="true">' + groupArg() + '<mo stretchy="true">_</mo></munder>'
        if (name === 'underbrace') return '<munder>' + groupArg() + '<mo stretchy="true">⏟</mo></munder>'
        if (name === 'overbrace') return '<mover>' + groupArg() + '<mo stretchy="true">⏞</mo></mover>'
        if (name === 'begin') return environment(rawArg())
        if (name === 'end') { rawArg(); return '' }
        if (TEX_SPACES[name]) return '<mspace width="' + TEX_SPACES[name] + '"></mspace>'
        if (name === '!' || name === '\\' || name === 'limits' || name === 'nolimits' || name === 'displaystyle' || name === 'textstyle' || name === 'scriptstyle' || name === 'not' || name === 'nonumber' || name === 'notag') return ''
        if (name === '{' || name === '}' || name === '|' || name === '%' || name === '$' || name === '#' || name === '&' || name === '_') return '<mo>' + escapeXml(name === '|' ? '‖' : name) + '</mo>'
        if (TEX_GREEK[name]) return '<mi' + (/^[A-Z]/.test(name) ? ' mathvariant="normal"' : '') + '>' + TEX_GREEK[name] + '</mi>'
        if (TEX_IDENT[name]) return '<mi mathvariant="normal">' + TEX_IDENT[name] + '</mi>'
        if (TEX_OPS[name]) return '<mo>' + escapeXml(TEX_OPS[name]) + '</mo>'
        if (TEX_BIG_OPS[name]) { lastBigOp = true; return '<mo largeop="true">' + TEX_BIG_OPS[name] + '</mo>' }
        if (TEX_LIMIT_FUNCS.indexOf(name) >= 0) { lastBigOp = true; return '<mi mathvariant="normal">' + (name === 'argmax' ? 'arg max' : name === 'argmin' ? 'arg min' : name) + '</mi>' }
        if (TEX_FUNCS.indexOf(name) >= 0) return '<mi mathvariant="normal">' + name + '</mi><mo>&#x2061;</mo>'
        return '<mtext>' + escapeXml('\\' + name) + '</mtext>'
      }
      const parseAtom = function () {
        const tok = next()
        if (!tok) return ''
        if (tok.t === 'num') return '<mn>' + escapeXml(tok.v) + '</mn>'
        if (tok.t === 'ch') {
          const v = tok.v
          if (v === '{') {
            const items = parseRow(function (t) { return isCh(t, '}') })
            if (peek()) next()
            return mrow(items)
          }
          if (v === '}' || v === '&') return ''
          if (v === '~') return '<mspace width="0.25em"></mspace>'
          if (v === "'") return '<mo>′</mo>'
          if (/[a-zA-Z]/.test(v)) return '<mi>' + v + '</mi>'
          if (/[一-鿿]/.test(v)) return '<mtext>' + v + '</mtext>'
          return '<mo>' + escapeXml(v) + '</mo>'
        }
        return parseCommand(tok.v)
      }
      const parseScripted = function () {
        lastBigOp = false
        let base = parseAtom()
        const big = lastBigOp
        if (!base) base = '<mrow></mrow>'
        let sub = null
        let sup = null
        let guard = 0
        while (guard++ < 20) {
          const tok = peek()
          if (isCh(tok, '_') || isCh(tok, '^')) {
            next()
            const arg = groupArg()
            if (tok.v === '_') sub = arg
            else sup = arg
            continue
          }
          if (isCh(tok, "'")) { next(); sup = '<mo>′</mo>'; continue }
          break
        }
        // A trailing function-application mark must stay outside the script base.
        const applyMark = '<mo>&#x2061;</mo>'
        let tail = ''
        if ((sub || sup) && base.length > applyMark.length && base.slice(-applyMark.length) === applyMark) {
          tail = applyMark
          base = '<mrow>' + base.slice(0, -applyMark.length) + '</mrow>'
        }
        const under = big && display
        if (sub && sup) return (under ? '<munderover>' : '<msubsup>') + base + sub + sup + (under ? '</munderover>' : '</msubsup>') + tail
        if (sub) return (under ? '<munder>' : '<msub>') + base + sub + (under ? '</munder>' : '</msub>') + tail
        if (sup) return (under ? '<mover>' : '<msup>') + base + sup + (under ? '</mover>' : '</msup>') + tail
        return base
      }
      const body = parseRow(null)
      return '<math' + (display ? ' display="block"' : '') + '>' + mrow(body) + '</math>'
    }

    function richMath(tex, display, key) {
      let markup = ''
      try {
        markup = texToMathML(tex, display)
      } catch (error) {
        markup = ''
      }
      if (!markup) return h('code', { key: key, className: 'sc-md-code' }, tex)
      return h(display ? 'div' : 'span', {
        key: key,
        className: display ? 'sc-math sc-math-block' : 'sc-math',
        'data-tex': tex,
        dangerouslySetInnerHTML: { __html: markup },
      })
    }

    const RICH_INLINE = /\\\(([\s\S]+?)\\\)|\$(?!\s)([^$\n]+?)(?<!\s)\$|`([^`\n]+)`|\*\*([\s\S]+?)\*\*|__([^_\n]+?)__|\*(?!\s)([^*\n]+?)\*/g

    /** Inline Markdown: math, `code`, **bold**, *italic*. */
    function renderInline(text, keyPrefix) {
      const source = String(text || '')
      const out = []
      let last = 0
      let index = 0
      const prefix = keyPrefix || 'i'
      RICH_INLINE.lastIndex = 0
      const pattern = new RegExp(RICH_INLINE.source, 'g')
      let match
      while ((match = pattern.exec(source))) {
        if (match.index > last) out.push(source.slice(last, match.index))
        const key = prefix + '-' + index++
        if (match[1] !== undefined) out.push(richMath(match[1].trim(), false, key))
        else if (match[2] !== undefined) out.push(richMath(match[2].trim(), false, key))
        else if (match[3] !== undefined) out.push(h('code', { key: key, className: 'sc-md-code' }, match[3]))
        else if (match[4] !== undefined) out.push(h('strong', { key: key }, renderInline(match[4], key)))
        else if (match[5] !== undefined) out.push(h('strong', { key: key }, renderInline(match[5], key)))
        else if (match[6] !== undefined) out.push(h('em', { key: key }, renderInline(match[6], key)))
        last = pattern.lastIndex
      }
      if (last < source.length) out.push(source.slice(last))
      return out
    }

    function renderInlineLines(text, keyPrefix) {
      const lines = String(text || '').split('\n')
      const out = []
      lines.forEach(function (line, index) {
        if (index) out.push(h('br', { key: keyPrefix + '-br' + index }))
        out.push.apply(out, renderInline(line, keyPrefix + '-l' + index))
      })
      return out
    }

    /** Block Markdown (headings, lists, quotes, tables, code, display math). */
    function renderRich(text, keyPrefix) {
      const prefix = keyPrefix || 'md'
      const stash = []
      const hold = function (block) { stash.push(block); return '\n\u0000B' + (stash.length - 1) + '\u0000\n' }
      let source = String(text || '').replace(/\r\n?/g, '\n')
      source = source.replace(/```[^\n`]*\n([\s\S]*?)```/g, function (_, code) { return hold({ kind: 'code', value: code.replace(/\n$/, '') }) })
      source = source.replace(/\$\$([\s\S]+?)\$\$/g, function (_, tex) { return hold({ kind: 'math', value: tex.trim() }) })
      source = source.replace(/\\\[([\s\S]+?)\\\]/g, function (_, tex) { return hold({ kind: 'math', value: tex.trim() }) })

      const blocks = []
      let paragraph = []
      let quote = []
      let listRoot = null
      let stack = []
      let table = []
      let blockIndex = 0
      const nextKey = function () { return prefix + '-b' + blockIndex++ }

      const flushParagraph = function () {
        if (!paragraph.length) return
        const key = nextKey()
        blocks.push(h('p', { key: key, className: 'sc-md-p' }, renderInlineLines(paragraph.join('\n'), key)))
        paragraph = []
      }
      const flushQuote = function () {
        if (!quote.length) return
        const key = nextKey()
        blocks.push(h('blockquote', { key: key, className: 'sc-md-quote' }, renderInlineLines(quote.join('\n'), key)))
        quote = []
      }
      const renderList = function (list, key) {
        return h(list.type, { key: key, className: 'sc-md-list', start: list.type === 'ol' && list.start > 1 ? list.start : undefined },
          list.items.map(function (item, index) {
            const itemKey = key + '-' + index
            return h('li', { key: itemKey },
              renderInlineLines(item.content, itemKey),
              item.children.map(function (child, childIndex) { return renderList(child, itemKey + '-c' + childIndex) }))
          }))
      }
      const flushList = function () {
        if (!listRoot) return
        blocks.push(renderList(listRoot, nextKey()))
        listRoot = null
        stack = []
      }
      const addItem = function (type, indent, content, start) {
        while (stack.length && stack[stack.length - 1].indent > indent) stack.pop()
        let top = stack[stack.length - 1]
        if (top && top.indent === indent && top.type !== type) {
          stack.pop()
          top = stack[stack.length - 1]
        }
        if (!top && listRoot) flushList()
        if (top && top.indent === indent) { top.items.push({ content: content, children: [] }); return }
        const list = { type: type, indent: indent, start: start, items: [{ content: content, children: [] }] }
        if (top) top.items[top.items.length - 1].children.push(list)
        else listRoot = list
        stack.push(list)
      }
      const splitRow = function (line) {
        return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(function (cell) { return cell.trim() })
      }
      const flushTable = function () {
        if (!table.length) return
        const rows = table
        table = []
        const isSeparator = rows.length > 1 && /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(rows[1])
        if (!isSeparator) { paragraph = paragraph.concat(rows); flushParagraph(); return }
        const key = nextKey()
        const head = splitRow(rows[0])
        const body = rows.slice(2).map(splitRow)
        blocks.push(h('div', { key: key, className: 'sc-md-table-wrap' },
          h('table', { className: 'sc-md-table' },
            h('thead', null, h('tr', null, head.map(function (cell, i) { return h('th', { key: i }, renderInline(cell, key + '-h' + i)) }))),
            h('tbody', null, body.map(function (row, r) {
              return h('tr', { key: r }, row.map(function (cell, i) { return h('td', { key: i }, renderInline(cell, key + '-' + r + '-' + i)) }))
            })))))
      }
      const flushAll = function () { flushParagraph(); flushQuote(); flushList(); flushTable() }

      source.split('\n').forEach(function (line) {
        const placeholder = /^\s*\u0000B(\d+)\u0000\s*$/.exec(line)
        if (placeholder) {
          flushAll()
          const block = stash[Number(placeholder[1])]
          const key = nextKey()
          blocks.push(block.kind === 'code'
            ? h('pre', { key: key, className: 'sc-md-pre' }, h('code', null, block.value))
            : richMath(block.value, true, key))
          return
        }
        if (/^\s*\|.*\|\s*$/.test(line)) {
          if (!table.length) { flushParagraph(); flushQuote(); flushList() }
          table.push(line)
          return
        }
        if (table.length) flushTable()
        if (!line.trim()) { flushParagraph(); flushQuote(); return }
        const heading = /^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line)
        if (heading) {
          flushAll()
          const key = nextKey()
          const level = Math.min(heading[1].length, 4)
          blocks.push(h('div', { key: key, className: 'sc-md-h sc-md-h' + level, role: 'heading', 'aria-level': level + 2 }, renderInline(heading[2], key)))
          return
        }
        if (/^\s{0,3}([-*_])(\s*\1){2,}\s*$/.test(line)) { flushAll(); blocks.push(h('hr', { key: nextKey(), className: 'sc-md-hr' })); return }
        const bullet = /^(\s*)[-*+•]\s+(.*)$/.exec(line)
        const ordered = /^(\s*)(\d+)[.)、]\s+(.*)$/.exec(line)
        if (bullet || ordered) {
          flushParagraph()
          flushQuote()
          const indent = (bullet ? bullet[1] : ordered[1]).replace(/\t/g, '    ').length
          if (bullet) addItem('ul', indent, bullet[2], 1)
          else addItem('ol', indent, ordered[3], Number(ordered[2]))
          return
        }
        const quoted = /^\s*>\s?(.*)$/.exec(line)
        if (quoted) { flushParagraph(); flushList(); quote.push(quoted[1]); return }
        if (listRoot && /^\s+\S/.test(line) && stack.length) {
          const deepest = stack[stack.length - 1]
          const item = deepest.items[deepest.items.length - 1]
          item.content += '\n' + line.trim()
          return
        }
        flushList()
        flushQuote()
        paragraph.push(line)
      })
      flushAll()
      return blocks
    }

    function persistChat(lessonId, kind, key, messages) {
      if (!lessonId || !key) return
      yktFetch('chats/save', { method: 'POST', body: { lessonId: lessonId, kind: kind, key: key, messages: Array.isArray(messages) ? messages : [] } })
        .catch(function () { /* saving is best effort */ })
    }

    /** Persist only the threads that changed since the last snapshot. */
    function persistChangedChats(lessonId, kind, savedMap, nextMap) {
      Object.keys(Object.assign({}, savedMap, nextMap)).forEach(function (key) {
        const next = Array.isArray(nextMap[key]) ? nextMap[key] : []
        if (JSON.stringify(next) === JSON.stringify(savedMap[key] || [])) return
        savedMap[key] = next.slice()
        persistChat(lessonId, kind, key, next)
      })
    }

    /** Chat bubble content: assistant answers are rich, student text stays plain. */
    function chatBubble(message) {
      if (message && message.role === 'assistant') {
        return h('div', { className: 'sc-ykt-msg-bubble sc-md' }, renderRich(message.text || '', 'msg'))
      }
      return h('div', { className: 'sc-ykt-msg-bubble' }, message ? message.text : '')
    }

    /** Unticked pages of one lesson as { [presentationId]: [index, ...] }. */
    function summaryExcludeFor(map, lessonId) {
      const lesson = (map && map[lessonId]) || {}
      const out = {}
      Object.keys(lesson).forEach(function (presentationId) {
        const pages = Object.keys(lesson[presentationId] || {})
          .filter(function (index) { return lesson[presentationId][index] })
          .map(Number)
          .filter(function (index) { return index > 0 })
          .sort(function (a, b) { return a - b })
        if (pages.length) out[presentationId] = pages
      })
      return out
    }

    function YktSlideViewer(props) {
      const t = props.t
      const slides = Array.isArray(props.slides) ? props.slides : []
      const index = props.index
      const slide = slides[index]
      const key = props.presentationId + ':' + (slide ? slide.index : index)
      const [zoom, setZoom] = React.useState(1)
      const [pan, setPan] = React.useState({ x: 0, y: 0 })
      const [tool, setTool] = React.useState('highlight')
      const [natural, setNatural] = React.useState({ w: 0, h: 0 })
      const [box, setBox] = React.useState({ w: 0, h: 0 })
      const [live, setLive] = React.useState(null)
      const [draft, setDraft] = React.useState('')
      const [sending, setSending] = React.useState(false)
      const [chatError, setChatError] = React.useState('')
      const stageRef = React.useRef(null)
      const canvasRef = React.useRef(null)
      const imgRef = React.useRef(null)
      const listRef = React.useRef(null)
      const panRef = React.useRef(null)
      const liveRef = React.useRef(null)
      const erasingRef = React.useRef(false)

      const annotations = props.annotations || {}
      const strokes = Array.isArray(annotations[key]) ? annotations[key] : []
      const chats = props.chats || {}
      const messages = Array.isArray(chats[key]) ? chats[key] : []

      React.useEffect(
        function () {
          setZoom(1)
          setPan({ x: 0, y: 0 })
          setLive(null)
          liveRef.current = null
          setDraft('')
          setSending(false)
          setChatError('')
          setNatural({ w: 0, h: 0 })
        },
        [key]
      )

      React.useEffect(
        function () {
          const node = stageRef.current
          if (!node) return undefined
          const measure = function () {
            const rect = node.getBoundingClientRect()
            if (rect && rect.width && rect.height) setBox({ w: rect.width, h: rect.height })
          }
          measure()
          if (typeof ResizeObserver === 'undefined') {
            window.addEventListener('resize', measure)
            return function () { window.removeEventListener('resize', measure) }
          }
          const observer = new ResizeObserver(measure)
          observer.observe(node)
          return function () { observer.disconnect() }
        },
        []
      )

      React.useEffect(
        function () {
          const image = imgRef.current
          if (image && image.complete && image.naturalWidth) setNatural({ w: image.naturalWidth, h: image.naturalHeight })
        },
        [key, props.slides]
      )

      React.useEffect(
        function () {
          if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
        },
        [messages.length, sending]
      )

      React.useEffect(
        function () {
          const handler = function (event) {
            const tag = event.target && event.target.tagName
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
            if (event.key === 'Escape') {
              props.onClose()
              return
            }
            if (event.key === 'ArrowRight') props.onIndex(Math.min(slides.length - 1, index + 1))
            if (event.key === 'ArrowLeft') props.onIndex(Math.max(0, index - 1))
            if (event.key === '+' || event.key === '=') setZoom(function (value) { return Math.min(4, Math.round((value + 0.15) * 100) / 100) })
            if (event.key === '-') setZoom(function (value) { return Math.max(1, Math.round((value - 0.15) * 100) / 100) })
          }
          window.addEventListener('keydown', handler)
          return function () { window.removeEventListener('keydown', handler) }
        },
        [index, slides.length, props.onClose, props.onIndex]
      )

      const display = React.useMemo(
        function () {
          if (!natural.w || !natural.h || !box.w || !box.h) return { w: 0, h: 0 }
          const fit = Math.min((box.w - 56) / natural.w, (box.h - 56) / natural.h)
          return { w: Math.max(120, Math.round(natural.w * fit)), h: Math.max(90, Math.round(natural.h * fit)) }
        },
        [natural, box]
      )
      const dw = Math.round(display.w * zoom)
      const dh = Math.round(display.h * zoom)

      React.useEffect(
        function () {
          const canvas = canvasRef.current
          if (!canvas || !dw || !dh) return
          const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1
          canvas.width = Math.round(dw * dpr)
          canvas.height = Math.round(dh * dpr)
          const ctx = canvas.getContext('2d')
          if (!ctx) return
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
          ctx.clearRect(0, 0, dw, dh)
          const all = live ? strokes.concat([live]) : strokes
          all.forEach(function (stroke) { drawAnnotationStroke(ctx, stroke, dw, dh) })
        },
        [strokes, live, dw, dh]
      )

      if (!slide) return null
      const src = slideImageUrl(slide.cover)

      const commitStrokes = function (next) {
        props.onAnnotationsChange(function (previous) {
          const draftMap = Object.assign({}, previous || {})
          const current = Array.isArray(previous && previous[key]) ? previous[key] : []
          draftMap[key] = typeof next === 'function' ? next(current) : next
          return draftMap
        })
      }
      const pointFromEvent = function (event) {
        const canvas = canvasRef.current
        if (!canvas) return [0, 0]
        const rect = canvas.getBoundingClientRect()
        return [clamp01((event.clientX - rect.left) / Math.max(1, rect.width)), clamp01((event.clientY - rect.top) / Math.max(1, rect.height))]
      }
      const eraseAt = function (point) {
        const threshold = 0.022
        commitStrokes(function (current) {
          for (let i = current.length - 1; i >= 0; i -= 1) {
            const points = current[i].points || []
            for (const item of points) {
              if (Math.abs(item[0] - point[0]) < threshold && Math.abs(item[1] - point[1]) < threshold) {
                return current.slice(0, i).concat(current.slice(i + 1))
              }
            }
          }
          return current
        })
      }
      const capturePointer = function (event) {
        const target = event.currentTarget
        if (target && target.setPointerCapture && event.pointerId !== undefined) {
          try { target.setPointerCapture(event.pointerId) } catch (error) { /* noop */ }
        }
      }
      const onPointerDown = function (event) {
        if (event.button !== undefined && event.button !== 0) return
        const targetTag = event.target && event.target.tagName
        if (targetTag === 'BUTTON' || targetTag === 'SELECT' || targetTag === 'INPUT' || targetTag === 'TEXTAREA') return
        if (event.target && event.target.closest && event.target.closest('.sc-ykt-viewer-nav,.sc-ykt-viewer-zoom')) return
        if (tool === 'pan') {
          panRef.current = { x: event.clientX, y: event.clientY, ox: pan.x, oy: pan.y }
          capturePointer(event)
          return
        }
        if (!dw || !dh) return
        if (event.preventDefault) event.preventDefault()
        capturePointer(event)
        const point = pointFromEvent(event)
        if (tool === 'eraser') {
          erasingRef.current = true
          eraseAt(point)
          return
        }
        const stroke = { tool: tool === 'highlight' ? 'highlight' : 'pen', color: tool === 'highlight' ? '#ffd54f' : '#ef4444', points: [point] }
        liveRef.current = stroke
        setLive(stroke)
      }
      const onPointerMove = function (event) {
        if (panRef.current) {
          setPan({ x: panRef.current.ox + (event.clientX - panRef.current.x), y: panRef.current.oy + (event.clientY - panRef.current.y) })
          return
        }
        if (erasingRef.current) {
          eraseAt(pointFromEvent(event))
          return
        }
        const current = liveRef.current
        if (!current) return
        const next = { tool: current.tool, color: current.color, points: current.points.concat([pointFromEvent(event)]) }
        liveRef.current = next
        setLive(next)
      }
      const onPointerUp = function () {
        erasingRef.current = false
        if (panRef.current) {
          panRef.current = null
          return
        }
        const completed = liveRef.current
        if (completed) {
          commitStrokes(function (current) { return current.concat([completed]) })
          liveRef.current = null
          setLive(null)
        }
      }
      const onWheel = function (event) {
        if (event.preventDefault) event.preventDefault()
        const factor = event.deltaY < 0 ? 1.12 : 0.9
        setZoom(function (value) { return Math.max(1, Math.min(4, Math.round(value * factor * 100) / 100)) })
      }
      const updateChats = function (updater) {
        if (typeof props.onChatsChange !== 'function') return
        props.onChatsChange(function (previous) {
          const map = Object.assign({}, previous || {})
          const current = Array.isArray(previous && previous[key]) ? previous[key] : []
          map[key] = typeof updater === 'function' ? updater(current) : current
          return map
        })
      }
      const sendQuestion = function (preset) {
        const question = String(preset === undefined ? draft : preset).trim()
        if (!question || sending) return
        setDraft('')
        setChatError('')
        updateChats(function (current) { return current.concat([{ role: 'user', text: question }]) })
        setSending(true)
        const body = {
          lessonId: props.lessonId,
          presentationId: props.presentationId,
          slideIndex: slide.index,
          question: question,
          history: messages.slice(-8),
          annotations: strokes,
        }
        const sentStrokes = strokes.slice()
        const prepared = sentStrokes.length
          ? fetchSlideDataUrl(props.lessonId, props.presentationId, slide.index)
              .then(function (dataUrl) { return buildAnnotationImages(sentStrokes, dataUrl) })
              .then(function (images) {
                body.focus = images.focus
                body.marked = images.marked
                return body
              })
              .catch(function () {
                // Fall back to the transparent stroke layer + coordinates.
                body.overlay = buildOverlayDataUrl(sentStrokes, natural.w, natural.h)
                return body
              })
          : Promise.resolve(body)
        prepared
          .then(function (payload) { return yktFetch('page-chat', { method: 'POST', body: payload }) })
          .then(function (data) {
            updateChats(function (current) { return current.concat([{ role: 'assistant', text: data.answer || '' }]) })
          })
          .catch(function (cause) {
            setChatError(t('ykt.chatFailed', { detail: (cause && cause.message) || String(cause) }))
          })
          .finally(function () { setSending(false) })
      }
      const clearChat = function () {
        updateChats(function () { return [] })
      }
      const toolButton = function (id, label) {
        return h('button', {
          key: id,
          type: 'button',
          className: 'sc-ykt-tool',
          'data-active': tool === id ? '1' : '0',
          title: label,
          onClick: function () { setTool(id) },
        }, label)
      }

      const viewer = h(
        'div',
        { className: 'sc-ykt-viewer', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('ykt.viewerOpen') },
        // Empty strip under the desktop caption: it keeps the window draggable
        // and leaves the native minimise/maximise/close buttons uncovered.
        h('div', { className: 'sc-ykt-viewer-caption', 'aria-hidden': 'true' }),
        h(
          'header',
          { className: 'sc-ykt-viewer-head' },
          h(
            'div',
            { className: 'sc-ykt-viewer-title' },
            h('button', { type: 'button', className: 'sc-btn sc-ykt-viewer-close', onClick: props.onClose, 'aria-label': t('ykt.close'), title: t('ykt.close') }, '✕'),
            h('strong', null, props.lessonTitle || ''),
            h('span', { className: 'sc-ykt-viewer-page' }, t('ykt.slideN', { n: slide.index }) + ' / ' + slides.length)
          ),
          h(
            'div',
            { className: 'sc-ykt-viewer-tools' },
            toolButton('pan', t('ykt.tool.pan')),
            toolButton('highlight', t('ykt.tool.highlight')),
            toolButton('pen', t('ykt.tool.pen')),
            toolButton('eraser', t('ykt.tool.eraser')),
            h('span', { className: 'sc-ykt-viewer-sep' }),
            h('button', { type: 'button', className: 'sc-ykt-tool', onClick: function () { commitStrokes(function (current) { return current.slice(0, -1) }) } }, t('ykt.tool.undo')),
            h('button', { type: 'button', className: 'sc-ykt-tool', onClick: function () { commitStrokes(function () { return [] }) } }, t('ykt.tool.clear')),
            h('span', { className: 'sc-ykt-viewer-sep' }),
            h(YktModelPicker, { t: t, models: props.models, busy: props.modelBusy, onSave: props.onSaveModel })
          )
        ),
        h('div', { className: 'sc-ykt-viewer-hint' }, t('ykt.viewerHint')),
        h(
          'div',
          { className: 'sc-ykt-viewer-body' },
          h(
            'div',
            { className: 'sc-ykt-viewer-stage', ref: stageRef, onWheel: onWheel, onPointerDown: onPointerDown, onPointerMove: onPointerMove, onPointerUp: onPointerUp, onPointerCancel: onPointerUp },
            h(
              'div',
              { className: 'sc-ykt-viewer-canvasbox', style: { width: dw + 'px', height: dh + 'px', transform: 'translate(' + pan.x + 'px,' + pan.y + 'px)' } },
              src
                ? h('img', { ref: imgRef, src: src, alt: t('ykt.slideAlt', { index: slide.index }), draggable: false, onLoad: function (event) {
                    const image = event.currentTarget || imgRef.current
                    if (image && image.naturalWidth) setNatural({ w: image.naturalWidth, h: image.naturalHeight })
                  }, style: { width: dw + 'px', height: dh + 'px' } })
                : h('div', { className: 'sc-ykt-viewer-noimg' }, '—'),
              h('canvas', {
                ref: canvasRef,
                className: 'sc-ykt-anno',
                style: { width: dw + 'px', height: dh + 'px', cursor: tool === 'pan' ? 'grab' : tool === 'eraser' ? 'not-allowed' : 'crosshair' },
              })
            ),
            h(
              'div',
              { className: 'sc-ykt-viewer-nav' },
              h('button', { type: 'button', className: 'sc-ykt-viewer-navbtn', disabled: index <= 0, onClick: function () { props.onIndex(Math.max(0, index - 1)) }, 'aria-label': t('ykt.prevPage') }, '‹'),
              h('span', null, slide.index + ' / ' + slides.length),
              h('button', { type: 'button', className: 'sc-ykt-viewer-navbtn', disabled: index >= slides.length - 1, onClick: function () { props.onIndex(Math.min(slides.length - 1, index + 1)) }, 'aria-label': t('ykt.nextPage') }, '›')
            ),
            h(
              'div',
              { className: 'sc-ykt-viewer-zoom' },
              h('button', { type: 'button', className: 'sc-ykt-viewer-navbtn', onClick: function () { setZoom(function (value) { return Math.max(1, Math.round((value - 0.15) * 100) / 100) }) }, 'aria-label': t('ykt.zoomOut') }, '−'),
              h('span', null, Math.round(zoom * 100) + '%'),
              h('button', { type: 'button', className: 'sc-ykt-viewer-navbtn', onClick: function () { setZoom(function (value) { return Math.min(4, Math.round((value + 0.15) * 100) / 100) }) }, 'aria-label': t('ykt.zoomIn') }, '+'),
              h('button', { type: 'button', className: 'sc-ykt-tool', onClick: function () { setZoom(1); setPan({ x: 0, y: 0 }) } }, t('ykt.zoomReset'))
            )
          ),
          h(
            'aside',
            { className: 'sc-ykt-chat' },
            h(
              'div',
              { className: 'sc-ykt-chat-head' },
              h('strong', null, t('ykt.chatTitle')),
              h('button', { type: 'button', className: 'sc-linkbtn', onClick: clearChat }, t('ykt.chatClear'))
            ),
            strokes.length ? h('div', { className: 'sc-ykt-chat-anno' }, t('ykt.chatAnnotation', { n: strokes.length })) : null,
            h(
              'div',
              { className: 'sc-ykt-chat-list', ref: listRef },
              messages.length
                ? messages.map(function (message, messageIndex) {
                    return h('div', { key: messageIndex, className: 'sc-ykt-msg', 'data-role': message.role }, chatBubble(message))
                  })
                : h('p', { className: 'sc-ykt-chat-empty' }, t('ykt.chatEmpty')),
              sending ? h('div', { className: 'sc-ykt-chat-thinking' }, t('ykt.chatThinking')) : null
            ),
            chatError ? h('div', { className: 'sc-alert', role: 'alert' }, chatError) : null,
            h(
              'div',
              { className: 'sc-ykt-chat-quick' },
              ['ykt.chatQuick1', 'ykt.chatQuick2', 'ykt.chatQuick3'].map(function (key) {
                return h('button', { key: key, type: 'button', className: 'sc-ykt-chip', disabled: sending, onClick: function () { sendQuestion(t(key)) } }, t(key))
              })
            ),
            h(
              'div',
              { className: 'sc-ykt-chat-input' },
              h('textarea', {
                className: 'sc-input sc-textarea sc-ykt-chat-textarea',
                value: draft,
                placeholder: t('ykt.chatPlaceholder'),
                onChange: function (event) { setDraft(event.target.value) },
                onKeyDown: function (event) {
                  if (event.key === 'Enter' && !event.shiftKey && !(event.nativeEvent && event.nativeEvent.isComposing)) {
                    event.preventDefault()
                    sendQuestion()
                  }
                },
              }),
              h('button', { type: 'button', className: 'sc-btn sc-btn-primary', disabled: sending || !draft.trim(), onClick: function () { sendQuestion() } }, sending ? t('ykt.working') : t('ykt.chatSend'))
            )
          )
        )
      )
      if (ReactDOM && typeof ReactDOM.createPortal === 'function' && typeof document !== 'undefined' && document.body) {
        return ReactDOM.createPortal(viewer, document.body)
      }
      return viewer
    }

    function YktTab(props) {
      const t = props.t
      const [status, setStatus] = React.useState(null)
      const [loadingStatus, setLoadingStatus] = React.useState(true)
      const [region, setRegion] = React.useState('standard')
      const [sessionInput, setSessionInput] = React.useState('')
      const [loginMode, setLoginMode] = React.useState('qr')
      const [qrTicket, setQrTicket] = React.useState(null)
      const [qrImage, setQrImage] = React.useState('')
      const [qrState, setQrState] = React.useState('idle')
      const [busy, setBusy] = React.useState(false)
      const [error, setError] = React.useState('')
      const [notice, setNotice] = React.useState('')
      const [view, setView] = React.useState('courses')
      const [courses, setCourses] = React.useState([])
      const [courseQuery, setCourseQuery] = React.useState('')
      const [selectedCourse, setSelectedCourse] = React.useState(null)
      const [activities, setActivities] = React.useState([])
      const [progress, setProgress] = React.useState(null)
      const [detailTab, setDetailTab] = React.useState('lessons')
      const [lessonInfo, setLessonInfo] = React.useState(null)
      const [presentation, setPresentation] = React.useState(null)
      const [slides, setSlides] = React.useState([])
      const [models, setModels] = React.useState(null)
      const [modelBusy, setModelBusy] = React.useState(false)
      const [summaryJobs, setSummaryJobs] = React.useState({})
      const [summaries, setSummaries] = React.useState({})
      const [summaryError, setSummaryError] = React.useState('')
      const [cardsBusy, setCardsBusy] = React.useState(false)
      const [annotations, setAnnotations] = React.useState({})
      // Unticked slides per lesson: { [lessonId]: { [presentationId]: { [index]: true } } }.
      // Everything is included by default, so decks never opened stay included.
      const [slideExcludes, setSlideExcludes] = React.useState({})
      const [pageChats, setPageChats] = React.useState({})
      const [boardSavedChats, setBoardSavedChats] = React.useState({})
      const [chatResetEpoch, setChatResetEpoch] = React.useState(0)
      const savedPageChatsRef = React.useRef({ lessonId: '', map: {} })
      const [viewerIndex, setViewerIndex] = React.useState(-1)
      const requestEpoch = React.useRef(0)

      const loadCourses = React.useCallback(function () {
        const epoch = ++requestEpoch.current
        setBusy(true)
        setError('')
        return yktFetch('courses')
          .then(function (data) {
            if (requestEpoch.current !== epoch) return
            setCourses(data.courses || [])
          })
          .catch(function (cause) {
            if (requestEpoch.current !== epoch) return
            const message = cause.message || String(cause)
            setError(/HTTP 500/.test(message) ? t('ykt.cookie500') : message)
          })
          .finally(function () {
            if (requestEpoch.current === epoch) setBusy(false)
          })
      }, [])

      const loadModels = React.useCallback(function () {
        return yktFetch('models')
          .then(function (data) {
            setModels(data)
          })
          .catch(function (cause) {
            setModels({ providers: [], effective: null, override: null, error: (cause && cause.message) || String(cause) })
          })
      }, [])

      const saveModel = function (next) {
        setModelBusy(true)
        setError('')
        yktFetch('model', { method: 'POST', body: next || { reset: true } })
          .then(function () { return loadModels() })
          .catch(function (cause) {
            setError(t('ykt.modelSaveFailed', { detail: (cause && cause.message) || String(cause) }))
          })
          .finally(function () { setModelBusy(false) })
      }

      const refreshSummary = React.useCallback(function (lessonId) {
        if (!lessonId) return Promise.resolve()
        return yktFetch('summary/status?lessonId=' + encodeURIComponent(lessonId))
          .then(function (data) {
            if (!data || !data.job) return
            setSummaryJobs(function (prev) {
              const next = Object.assign({}, prev)
              next[lessonId] = data.job
              return next
            })
            if (data.job.status === 'done' && data.job.result) {
              setSummaries(function (prev) {
                const next = Object.assign({}, prev)
                next[lessonId] = data.job.result
                return next
              })
            }
          })
          .catch(function () {})
      }, [])

      React.useEffect(
        function () {
          const running = Object.keys(summaryJobs).filter(function (lessonId) {
            const job = summaryJobs[lessonId]
            return job && (job.status === 'queued' || job.status === 'running')
          })
          if (!running.length) return undefined
          // Short interval: the knowledge board grows node by node while running.
          const timer = setTimeout(function () {
            running.forEach(function (lessonId) { refreshSummary(lessonId) })
          }, 900)
          return function () { clearTimeout(timer) }
        },
        [summaryJobs, refreshSummary]
      )

      React.useEffect(
        function () {
          const saved = savedPageChatsRef.current
          if (!saved.lessonId) return
          persistChangedChats(saved.lessonId, 'page', saved.map, pageChats || {})
        },
        [pageChats]
      )

      const clearLessonChats = function (lessonId) {
        if (!lessonId) return
        yktFetch('chats/clear', { method: 'POST', body: { lessonId: lessonId } })
          .then(function () {
            savedPageChatsRef.current = { lessonId: lessonId, map: {} }
            setPageChats({})
            setBoardSavedChats({})
            setChatResetEpoch(function (value) { return value + 1 })
            setNotice(t('ykt.chatStoreCleared'))
          })
          .catch(function (cause) { setError((cause && cause.message) || String(cause)) })
      }

      const startSummary = function (lessonId, force) {
        if (!lessonId) return
        const exclude = summaryExcludeFor(slideExcludes, lessonId)
        const excludedTotal = Object.keys(exclude).reduce(function (sum, id) { return sum + exclude[id].length }, 0)
        setSummaryError('')
        setSummaryJobs(function (prev) {
          const next = Object.assign({}, prev)
          next[lessonId] = { lessonId: lessonId, status: 'queued', phase: 'prepare', progress: 0.01, message: t('ykt.summaryPhase.prepare'), readSlides: 0, totalSlides: 0 }
          return next
        })
        // A partial selection never reuses the cached full summary.
        yktFetch('summary/start', { method: 'POST', body: { lessonId: lessonId, force: !!force || excludedTotal > 0, exclude: exclude } })
          .then(function (data) {
            if (!data || !data.job) return
            setSummaryJobs(function (prev) {
              const next = Object.assign({}, prev)
              next[lessonId] = data.job
              return next
            })
            if (data.job.status === 'done' && data.job.result) {
              setSummaries(function (prev) {
                const next = Object.assign({}, prev)
                next[lessonId] = data.job.result
                return next
              })
            }
          })
          .catch(function (cause) {
            const detail = (cause && cause.message) || String(cause)
            setSummaryError(t('ykt.summaryFailed', { detail: detail }))
            setSummaryJobs(function (prev) {
              const next = Object.assign({}, prev)
              if (next[lessonId]) next[lessonId] = Object.assign({}, next[lessonId], { status: 'error', error: detail, message: t('ykt.summaryFailed', { detail: detail }) })
              return next
            })
          })
      }

      const cancelSummary = function (lessonId) {
        yktFetch('summary/cancel', { method: 'POST', body: { lessonId: lessonId } })
          .then(function (data) {
            if (data && data.job) {
              setSummaryJobs(function (prev) {
                const next = Object.assign({}, prev)
                next[lessonId] = data.job
                return next
              })
            }
          })
          .catch(function () {})
      }

      const saveSummaryCards = function (lessonId) {
        setCardsBusy(true)
        setError('')
        setNotice('')
        yktFetch('summary/cards', { method: 'POST', body: { lessonId: lessonId } })
          .then(function (data) {
            setNotice(data && data.added ? t('ykt.summaryCardsDone', { n: data.added }) : t('ykt.summaryCardsEmpty'))
          })
          .catch(function (cause) {
            setError(t('ykt.summaryCardsFailed', { detail: (cause && cause.message) || String(cause) }))
          })
          .finally(function () { setCardsBusy(false) })
      }

      React.useEffect(function () {
        let alive = true
        yktFetch('status')
          .then(function (data) {
            if (!alive) return
            setStatus(data)
            setRegion(data.region || 'standard')
            setLoadingStatus(false)
            if (data.loggedIn) {
              loadCourses()
              loadModels()
            }
          })
          .catch(function (cause) {
            if (!alive) return
            const message = cause.message || String(cause)
            setError(/404/.test(message) ? t('ykt.bridgeMissing') : message)
            setLoadingStatus(false)
          })
        return function () {
          alive = false
        }
      }, [loadCourses, loadModels])

      React.useEffect(function () {
        if (!qrTicket || qrState !== 'waiting') return undefined
        let alive = true
        let timer = null
        const poll = function () {
          yktFetch('qr/poll', { method: 'POST', body: { token: qrTicket.token } })
            .then(function (data) {
              if (!alive) return
              if (data.status === 'success') {
                setStatus(data.login)
                setQrState('success')
                setNotice(t('ykt.loginSuccess'))
                loadCourses()
                loadModels()
              } else if (data.status === 'expired') {
                setQrState('expired')
                setError(t('ykt.qrExpired'))
              } else {
                timer = setTimeout(poll, 2200)
              }
            })
            .catch(function (cause) {
              if (!alive) return
              setQrState('expired')
              setError(cause.message || String(cause))
            })
        }
        timer = setTimeout(poll, 1200)
        return function () {
          alive = false
          if (timer !== null) clearTimeout(timer)
        }
      }, [qrTicket, qrState, loadCourses, loadModels])

      const startQr = function () {
        setQrState('loading')
        setError('')
        setNotice('')
        yktFetch('qr', { method: 'POST', body: { region: region } })
          .then(function (data) {
            const code = qrcode(0, 'M')
            code.addData(data.qrContent)
            code.make()
            const svg = code.createSvgTag({ cellSize: 4, margin: 8, scalable: true })
            setQrTicket(data)
            setQrImage('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg))
            setQrState('waiting')
          })
          .catch(function (cause) {
            setQrState('idle')
            setError(cause.message || String(cause))
          })
      }

      const login = function () {
        const value = sessionInput.trim().replace(/^cookie\s*:\s*/i, '')
        if (!value) {
          setError(t('ykt.sessionRequired'))
          return
        }
        setBusy(true)
        setError('')
        setNotice('')
        yktFetch('login', { method: 'POST', body: { cookie: value, region: region } })
          .then(function (data) {
            setStatus(data)
            setSessionInput('')
            setNotice(t('ykt.loginSuccess'))
            loadCourses()
            loadModels()
          })
          .catch(function (cause) {
            setError(cause.message || String(cause))
          })
          .finally(function () {
            setBusy(false)
          })
      }

      const logout = function () {
        requestEpoch.current += 1
        setBusy(true)
        setNotice('')
        yktFetch('logout', { method: 'POST', body: {} })
          .then(function (data) {
            setStatus(data)
            setCourses([])
            setSelectedCourse(null)
            setView('courses')
            setQrTicket(null)
            setQrImage('')
            setQrState('idle')
            setModels(null)
            setSummaryJobs({})
            setSummaries({})
            setSummaryError('')
            setAnnotations({})
            setPageChats({})
            setViewerIndex(-1)
            setNotice(t('ykt.logoutDone'))
          })
          .catch(function (cause) {
            setError(cause.message || String(cause))
          })
          .finally(function () {
            setBusy(false)
          })
      }

      const openCourse = function (course) {
        const epoch = ++requestEpoch.current
        setSelectedCourse(course)
        setView('course')
        setDetailTab('lessons')
        setLessonInfo(null)
        setPresentation(null)
        setSlides([])
        setActivities([])
        setProgress(null)
        setViewerIndex(-1)
        setSummaryError('')
        setBusy(true)
        setError('')
        const activitiesJob = yktFetch('activities?classroomId=' + encodeURIComponent(course.classroomId))
        const progressJob = course.courseId
          ? yktFetch('progress?classroomId=' + encodeURIComponent(course.classroomId) + '&courseId=' + encodeURIComponent(course.courseId)).catch(function () { return null })
          : Promise.resolve(null)
        activitiesJob
          .then(function (data) {
            if (requestEpoch.current !== epoch) return
            setActivities(data.activities || [])
          })
          .catch(function (cause) {
            if (requestEpoch.current !== epoch) return
            setError(cause.message || String(cause))
          })
          .finally(function () {
            if (requestEpoch.current === epoch) setBusy(false)
          })
        progressJob
          .then(function (data) {
            if (requestEpoch.current !== epoch) return
            setProgress(data || null)
          })
          .catch(function () {
            if (requestEpoch.current === epoch) setProgress(null)
          })
      }

      const openLesson = function (activity) {
        const lessonId = activity.coursewareId || activity.id
        if (!lessonId) return
        const epoch = ++requestEpoch.current
        setBusy(true)
        setError('')
        setLessonInfo(null)
        setPresentation(null)
        setSlides([])
        setViewerIndex(-1)
        setSummaryError('')
        setPageChats({})
        setBoardSavedChats({})
        savedPageChatsRef.current = { lessonId: '', map: {} }
        yktFetch('chats/load', { method: 'POST', body: { lessonId: lessonId } })
          .catch(function () { return { page: {}, board: {} } })
          .then(function (data) {
            if (requestEpoch.current !== epoch) return
            const page = (data && data.page) || {}
            savedPageChatsRef.current = { lessonId: lessonId, map: Object.assign({}, page) }
            setPageChats(function (prev) { return Object.assign({}, page, prev) })
            setBoardSavedChats((data && data.board) || {})
          })
        yktFetch('lesson?lessonId=' + encodeURIComponent(lessonId))
          .then(function (data) {
            if (requestEpoch.current !== epoch) return undefined
            setLessonInfo(Object.assign({ lessonId: lessonId }, data))
            const presentations = (data.summary && data.summary.presentations) || []
            const first = presentations[0] || ((data.info && data.info.presentationIds && data.info.presentationIds[0]) ? { id: data.info.presentationIds[0], title: t('ykt.courseware') } : null)
            setPresentation(first)
            setSlides([])
            setView('lesson')
            refreshSummary(lessonId)
            if (first) {
              return yktFetch('slides?lessonId=' + encodeURIComponent(lessonId) + '&presentationId=' + encodeURIComponent(first.id)).then(function (slideData) {
                if (requestEpoch.current !== epoch) return
                setSlides(slideData.slides || [])
              })
            }
            return undefined
          })
          .catch(function (cause) {
            if (requestEpoch.current !== epoch) return
            setError(cause.message || String(cause))
          })
          .finally(function () {
            if (requestEpoch.current === epoch) setBusy(false)
          })
      }

      const startSummaryForActivity = function (activity) {
        const lessonId = activity.coursewareId || activity.id
        if (!lessonId) return
        openLesson(activity)
        startSummary(lessonId, false)
      }

      const selectPresentation = function (item) {
        if (!lessonInfo || !item) return
        const epoch = ++requestEpoch.current
        setPresentation(item)
        setSlides([])
        setViewerIndex(-1)
        setBusy(true)
        yktFetch('slides?lessonId=' + encodeURIComponent(lessonInfo.lessonId) + '&presentationId=' + encodeURIComponent(item.id))
          .then(function (data) {
            if (requestEpoch.current !== epoch) return
            setSlides(data.slides || [])
          })
          .catch(function (cause) {
            if (requestEpoch.current !== epoch) return
            setError(cause.message || String(cause))
          })
          .finally(function () {
            if (requestEpoch.current === epoch) setBusy(false)
          })
      }

      const analysisPrompt = function () {
        if (!selectedCourse || !lessonInfo) return ''
        return t('ykt.analysisPrompt', {
          course: selectedCourse.name || '',
          lesson: (lessonInfo.info && (lessonInfo.info.lessonName || lessonInfo.summary.lessonTitle)) || '',
          lessonId: lessonInfo.lessonId,
          classroomId: selectedCourse.classroomId,
          courseId: selectedCourse.courseId || '',
        })
      }

      const copyAnalysis = function () {
        const prompt = analysisPrompt()
        if (!prompt) return
        copyText(prompt)
          .then(function () {
            setNotice(t('ykt.promptCopied'))
            setError('')
          })
          .catch(function (cause) {
            setError(t('ykt.copyFailed', { detail: cause.message || String(cause) }))
          })
      }

      if (loadingStatus) {
        return h(LoadingBlock, { text: t('ykt.loading') })
      }

      if (!status || !status.loggedIn) {
        return h(
          'div',
          { className: 'sc-ykt-login' },
          h('div', { className: 'sc-ykt-login-card' },
            h('div', { className: 'sc-ykt-login-icon' }, h(BookIcon, { size: 26 })),
            h('h3', { className: 'sc-ykt-login-title' }, t('ykt.loginTitle')),
            h('p', { className: 'sc-muted' }, t('ykt.loginBody')),
            h('div', { className: 'sc-ykt-subtabs sc-ykt-login-tabs' },
              h('button', { type: 'button', className: 'sc-ykt-subtab', 'data-active': loginMode === 'qr' ? '1' : '0', onClick: function () { setLoginMode('qr') } }, t('ykt.qrMode')),
              h('button', { type: 'button', className: 'sc-ykt-subtab', 'data-active': loginMode === 'session' ? '1' : '0', onClick: function () { setLoginMode('session'); setQrTicket(null); setQrState('idle') } }, t('ykt.sessionMode'))
            ),
            h('label', { className: 'sc-ykt-label' }, t('ykt.region')),
            h('select', {
              className: 'sc-input',
              value: region,
              onChange: function (event) { setRegion(event.target.value); setQrTicket(null); setQrImage(''); setQrState('idle') },
            }, YKT_REGIONS.map(function (id) {
              return h('option', { key: id, value: id }, t('ykt.region.' + id))
            })),
            loginMode === 'qr'
              ? h('div', { className: 'sc-ykt-qr' },
                  qrImage
                    ? h('img', { className: 'sc-ykt-qr-img', src: qrImage, alt: t('ykt.qrAlt') })
                    : h('div', { className: 'sc-ykt-qr-placeholder' }, h(BookIcon, { size: 36 })),
                  h('p', { className: 'sc-ykt-help' }, qrState === 'expired' ? t('ykt.qrExpired') : t('ykt.scanHint')),
                  h('button', { type: 'button', className: 'sc-btn sc-btn-primary', disabled: qrState === 'loading' || qrState === 'waiting', onClick: startQr }, qrState === 'loading' ? t('ykt.working') : (qrImage ? t('ykt.refreshQr') : t('ykt.getQr')))
                )
              : h('div', { className: 'sc-ykt-form' },
                  h('label', { className: 'sc-ykt-label' }, t('ykt.session')),
                  h('input', {
                    className: 'sc-input',
                    type: 'password',
                    autoComplete: 'off',
                    value: sessionInput,
                    placeholder: t('ykt.sessionPlaceholder'),
                    onChange: function (event) { setSessionInput(event.target.value) },
                    onKeyDown: function (event) { if (event.key === 'Enter') login() },
                  }),
                  h('button', { type: 'button', className: 'sc-btn sc-btn-primary', disabled: busy, onClick: login }, busy ? t('ykt.working') : t('ykt.loginAction')),
                  h('p', { className: 'sc-ykt-help' }, t('ykt.loginHelp'))
                ),
            notice ? h('div', { className: 'sc-ykt-ok', role: 'status' }, notice) : null,
            error ? h('div', { className: 'sc-alert', role: 'alert' }, error) : null
          )
        )
      }

      if (view === 'lesson' && selectedCourse && lessonInfo) {
        const info = lessonInfo.info || {}
        const lessonSummary = lessonInfo.summary || {}
        const presentations = lessonSummary.presentations && lessonSummary.presentations.length
          ? lessonSummary.presentations
          : (info.presentationIds || []).map(function (id) { return { id: id, title: t('ykt.courseware'), slidesCount: 0 } })
        const lessonId = lessonInfo.lessonId
        const summaryJob = summaryJobs[lessonId] || null
        const activeSummary = summaries[lessonId] || (summaryJob && summaryJob.result) || null
        const summaryRunning = summaryJob && (summaryJob.status === 'queued' || summaryJob.status === 'running')
        const summaryHasError = summaryJob && summaryJob.status === 'error'
        const summaryText = summaryMarkdown(activeSummary)
        const currentPresentationId = (presentation && presentation.id) || (presentations[0] && presentations[0].id) || ''
        const lessonExcludes = summaryExcludeFor(slideExcludes, lessonId)
        const currentExcluded = (slideExcludes[lessonId] && slideExcludes[lessonId][currentPresentationId]) || {}
        const pickedCount = slides.filter(function (slide) { return !currentExcluded[slide.index] }).length
        const excludedTotal = Object.keys(lessonExcludes).reduce(function (sum, id) { return sum + lessonExcludes[id].length }, 0)
        const otherExcluded = excludedTotal - (lessonExcludes[currentPresentationId] ? lessonExcludes[currentPresentationId].length : 0)
        const setCurrentExcluded = function (updater) {
          setSlideExcludes(function (prev) {
            const next = Object.assign({}, prev)
            const lesson = Object.assign({}, next[lessonId] || {})
            const current = Object.assign({}, lesson[currentPresentationId] || {})
            lesson[currentPresentationId] = updater(current)
            next[lessonId] = lesson
            return next
          })
        }
        const toggleSlide = function (index) {
          setCurrentExcluded(function (current) {
            if (current[index]) delete current[index]
            else current[index] = true
            return current
          })
        }
        const pickAll = function () { setCurrentExcluded(function () { return {} }) }
        const pickNone = function () {
          setCurrentExcluded(function () {
            const all = {}
            slides.forEach(function (slide) { all[slide.index] = true })
            return all
          })
        }
        const pickInvert = function () {
          setCurrentExcluded(function (current) {
            const flipped = {}
            slides.forEach(function (slide) { if (!current[slide.index]) flipped[slide.index] = true })
            return flipped
          })
        }
        const startLessonSummary = function (force) {
          if (presentations.length <= 1 && slides.length && pickedCount === 0) {
            setError(t('ykt.pickEmpty'))
            return
          }
          startSummary(lessonId, force)
        }
        return h(
          'div',
          { className: 'sc-ykt-detail' },
          h('div', { className: 'sc-ykt-crumbs' },
            h('button', { type: 'button', className: 'sc-linkbtn', onClick: function () { setView('course') } }, t('ykt.backToCourse')),
            h('span', { className: 'sc-muted' }, selectedCourse.name || '')),
          h('div', { className: 'sc-ykt-head' },
            h('div', null,
              h('h3', { className: 'sc-ykt-title' }, info.lessonName || lessonSummary.lessonTitle || info.lessonId || ''),
              h('p', { className: 'sc-muted' }, [info.courseName, info.classroomName, info.teacherName].filter(Boolean).join(' · '))),
            h('div', { className: 'sc-ykt-actions' },
              h(YktModelPicker, { t: t, models: models, busy: modelBusy, onSave: saveModel }),
              h('button', {
                type: 'button',
                className: 'sc-btn sc-btn-primary',
                disabled: summaryRunning,
                onClick: function () { startLessonSummary(!!activeSummary) },
              }, summaryRunning
                ? t('ykt.summaryInProgress', { pct: Math.round((Number(summaryJob.progress) || 0) * 100) })
                : excludedTotal > 0
                  ? t('ykt.summaryStartPicked', { n: excludedTotal })
                  : (activeSummary ? t('ykt.summaryAgain') : t('ykt.summaryStart'))),
              h('button', { type: 'button', className: 'sc-btn', onClick: copyAnalysis }, t('ykt.analyze')),
              h('button', { type: 'button', className: 'sc-btn', onClick: function () { if (selectedCourse) openCourse(selectedCourse) } }, t('ykt.refresh'))
            )
          ),
          h('p', { className: 'sc-ykt-hint' }, t('ykt.summaryHint')),
          h('div', { className: 'sc-ykt-chatstore' },
            h('span', { className: 'sc-ykt-hint' }, t('ykt.chatStoreHint')),
            h('button', { type: 'button', className: 'sc-linkbtn', onClick: function () { clearLessonChats(lessonId) } }, t('ykt.chatStoreClear'))),
          summaryHasError && activeSummary
            ? h('div', { className: 'sc-alert', role: 'alert' }, summaryJob.error || t('ykt.summaryFailed', { detail: '' }))
            : null,
          summaryRunning
            ? h(YktSummaryProgress, { t: t, job: summaryJob, onCancel: function () { cancelSummary(lessonId) } })
            : null,
          h(YktKnowledgeBoard, {
            key: 'board-' + lessonId,
            t: t,
            lessonId: lessonId,
            savedChats: boardSavedChats,
            chatResetEpoch: chatResetEpoch,
            presentationId: currentPresentationId,
            courseName: info.courseName || selectedCourse.name || '',
            lessonTitle: info.lessonName || lessonSummary.lessonTitle || '',
            board: (summaryJob && summaryJob.board) || (activeSummary && activeSummary.board) || null,
            live: !!summaryRunning,
            missing: !summaryRunning && !!activeSummary && !activeSummary.board && !activeSummary.raw,
            onOpenPage: function (page) {
              const position = slides.findIndex(function (slide) { return Number(slide.index) === Number(page) })
              if (position >= 0) setViewerIndex(position)
              else setNotice(t('ykt.boardPageMissing', { n: page }))
            },
          }),
          summaryRunning
            ? null
            : activeSummary
              ? h(YktSummaryView, {
                  t: t,
                  summary: activeSummary,
                  cached: summaryJob && summaryJob.cached,
                  busyCards: cardsBusy,
                  onCopy: function () {
                    copyText(summaryText).then(function () {
                      setNotice(t('ykt.summaryCopied'))
                      setError('')
                    }).catch(function (cause) {
                      setError(t('ykt.copyFailed', { detail: (cause && cause.message) || String(cause) }))
                    })
                  },
                  onCards: function () { saveSummaryCards(lessonId) },
                  onRegenerate: function () { startLessonSummary(true) },
                })
              : summaryHasError
                ? h('div', { className: 'sc-alert', role: 'alert' }, summaryJob.error || summaryError)
                : h('div', { className: 'sc-ykt-summary sc-ykt-summary-empty' },
                    h('p', null, t('ykt.summaryEmpty')),
                    h('p', { className: 'sc-ykt-hint' }, t('ykt.summaryHint'))),
          presentations.length > 1
            ? h('div', { className: 'sc-ykt-chips' }, presentations.map(function (item) {
                return h('button', {
                  key: item.id,
                  type: 'button',
                  className: 'sc-ykt-chip',
                  'data-active': presentation && presentation.id === item.id ? '1' : '0',
                  onClick: function () { selectPresentation(item) },
                }, item.title || item.id)
              }))
            : null,
          busy ? h(LoadingBlock, { text: t('ykt.loadingSlides') }) : null,
          error ? h('div', { className: 'sc-alert', role: 'alert' }, error) : null,
          notice ? h('div', { className: 'sc-ykt-ok', role: 'status' }, notice) : null,
          !busy && !slides.length
            ? h('p', { className: 'sc-muted' }, t('ykt.noSlides'))
            : null,
          slides.length
            ? h('div', { className: 'sc-ykt-pickbar' },
                h('div', { className: 'sc-ykt-pickbar-text' },
                  h('strong', { className: 'sc-ykt-pickbar-count' }, t('ykt.pickCount', { picked: pickedCount, total: slides.length })),
                  h('span', { className: 'sc-ykt-hint' }, otherExcluded > 0 ? t('ykt.pickHint') + ' ' + t('ykt.pickOther', { n: otherExcluded }) : t('ykt.pickHint'))),
                h('div', { className: 'sc-ykt-pickbar-actions' },
                  h('button', { type: 'button', className: 'sc-btn sc-btn-sm', disabled: summaryRunning || pickedCount === slides.length, onClick: pickAll }, t('ykt.pickAll')),
                  h('button', { type: 'button', className: 'sc-btn sc-btn-sm', disabled: summaryRunning || pickedCount === 0, onClick: pickNone }, t('ykt.pickNone')),
                  h('button', { type: 'button', className: 'sc-btn sc-btn-sm', disabled: summaryRunning, onClick: pickInvert }, t('ykt.pickInvert'))))
            : null,
          slides.length
            ? h('div', { className: 'sc-ykt-slides' }, slides.map(function (slide, slidePosition) {
                const src = slideImageUrl(slide.cover)
                const excluded = !!currentExcluded[slide.index]
                return h('figure', { className: 'sc-ykt-slide', key: slide.id || String(slide.index), 'data-excluded': excluded ? '1' : '0' },
                  h('label', { className: 'sc-ykt-slide-pick', title: t('ykt.pickSlide', { n: slide.index }) },
                    h('input', {
                      type: 'checkbox',
                      checked: !excluded,
                      disabled: summaryRunning,
                      'aria-label': t('ykt.pickSlide', { n: slide.index }),
                      onChange: function () { toggleSlide(slide.index) },
                    })),
                  h('button', {
                    type: 'button',
                    className: 'sc-ykt-slide-open',
                    title: t('ykt.viewerOpen'),
                    onClick: function () { setViewerIndex(slidePosition) },
                  },
                    src ? h('img', { src: src, alt: t('ykt.slideAlt', { index: slide.index }), loading: 'lazy' }) : h('div', { className: 'sc-ykt-slide-empty' }, '—'),
                    h('span', { className: 'sc-ykt-slide-zoom' }, '⤢')),
                  h('figcaption', null, t('ykt.slideN', { n: slide.index }), excluded ? h('span', { className: 'sc-ykt-slide-off' }, ' · ' + t('ykt.pickExcluded')) : null))
              }))
            : null,
          viewerIndex >= 0 && slides[viewerIndex]
            ? h(YktSlideViewer, {
                t: t,
                slides: slides,
                index: viewerIndex,
                lessonId: lessonId,
                presentationId: currentPresentationId,
                lessonTitle: info.lessonName || lessonSummary.lessonTitle || '',
                courseName: info.courseName || selectedCourse.name || '',
                models: models,
                modelBusy: modelBusy,
                onSaveModel: saveModel,
                annotations: annotations,
                onAnnotationsChange: setAnnotations,
                chats: pageChats,
                onChatsChange: setPageChats,
                onIndex: setViewerIndex,
                onClose: function () { setViewerIndex(-1) },
                onNotice: setNotice,
                onError: setError,
              })
            : null
        )
      }

      if (view === 'course' && selectedCourse) {
        const lessons = activities.filter(function (activity) { return activity.type === 14 })
        return h(
          'div',
          { className: 'sc-ykt-detail' },
          h('div', { className: 'sc-ykt-crumbs' },
            h('button', { type: 'button', className: 'sc-linkbtn', onClick: function () { setView('courses'); setSelectedCourse(null) } }, t('ykt.backToCourses')),
            h('span', { className: 'sc-muted' }, selectedCourse.name || '')),
          h('div', { className: 'sc-ykt-head' },
            h('div', null,
              h('h3', { className: 'sc-ykt-title' }, selectedCourse.name || ''),
              h('p', { className: 'sc-muted' }, [selectedCourse.className, selectedCourse.teacher, String(selectedCourse.term || '')].filter(Boolean).join(' · '))),
            h('div', { className: 'sc-ykt-actions' },
              h(YktModelPicker, { t: t, models: models, busy: modelBusy, onSave: saveModel }),
              h('button', { type: 'button', className: 'sc-btn', onClick: function () { openCourse(selectedCourse) } }, t('ykt.refresh')))
          ),
          h('div', { className: 'sc-ykt-subtabs' },
            h('button', { type: 'button', className: 'sc-ykt-subtab', 'data-active': detailTab === 'lessons' ? '1' : '0', onClick: function () { setDetailTab('lessons') } }, t('ykt.lessons') + ' (' + lessons.length + ')'),
            h('button', { type: 'button', className: 'sc-ykt-subtab', 'data-active': detailTab === 'progress' ? '1' : '0', onClick: function () { setDetailTab('progress') } }, t('ykt.progressTab'))
          ),
          busy ? h(LoadingBlock, { text: t('ykt.loading') }) : null,
          error ? h('div', { className: 'sc-alert', role: 'alert' }, error) : null,
          detailTab === 'lessons'
            ? (lessons.length
                ? h('div', { className: 'sc-ykt-list' }, lessons.map(function (activity) {
                    return h('div', {
                      key: activity.id,
                      className: 'sc-ykt-row sc-ykt-row-actions',
                    },
                      h('button', {
                        type: 'button',
                        className: 'sc-ykt-row-hit',
                        onClick: function () { openLesson(activity) },
                      },
                        h('span', { className: 'sc-ykt-row-main' },
                          h('span', { className: 'sc-ykt-row-title' }, activity.title || t('ykt.lesson')),
                          h('span', { className: 'sc-ykt-row-meta' }, formatYktTime(activity.createTime) + ' · ' + (activity.attended ? t('ykt.attended') : t('ykt.notAttended')))),
                        h('span', { className: 'sc-ykt-chevron' }, '›')),
                      h('button', {
                        type: 'button',
                        className: 'sc-btn sc-btn-sm',
                        onClick: function () { startSummaryForActivity(activity) },
                      }, t('ykt.summary')))
                  }))
                : h('p', { className: 'sc-muted' }, t('ykt.noLessons')))
            : (progress && progress.leaves && progress.leaves.length
                ? h('div', { className: 'sc-ykt-list' }, progress.leaves.map(function (leaf) {
                    return h('div', { className: 'sc-ykt-progress-row', key: leaf.leafId || leaf.name },
                      h('div', { className: 'sc-ykt-row-main' },
                        h('span', { className: 'sc-ykt-row-title' }, leaf.name),
                        h('span', { className: 'sc-ykt-row-meta' }, [(function () { const key = 'ykt.leafType.' + String(leaf.leafType); const label = t(key); return label === key ? '类型' + leaf.leafType : label })(), leaf.status || '', leaf.scoreDeadline ? t('ykt.deadline') + ' ' + formatYktTime(leaf.scoreDeadline) : ''].filter(Boolean).join(' · '))),
                      h('span', { className: 'sc-ykt-progress-score' }, leaf.userScore !== undefined ? leaf.userScore + '/' + (leaf.totalScore === undefined ? '—' : leaf.totalScore) : '—'))
                  }))
                : h('p', { className: 'sc-muted' }, t('ykt.noProgress')))
        )
      }

      const query = courseQuery.trim().toLowerCase()
      const visibleCourses = courses.filter(function (course) {
        if (!query) return true
        return [course.name, course.className, course.teacher].join(' ').toLowerCase().indexOf(query) >= 0
      })
      const terms = {}
      visibleCourses.forEach(function (course) {
        const key = String(course.term || '—')
        if (!terms[key]) terms[key] = []
        terms[key].push(course)
      })
      return h(
        'div',
        { className: 'sc-ykt-courses' },
        h('div', { className: 'sc-ykt-statusbar' },
          h('div', { className: 'sc-ykt-account' },
            h('span', { className: 'sc-ykt-dot' }),
            h('span', null, t('ykt.loggedAs', { name: status.account || t('ykt.unnamed') })),
            status.school ? h('span', { className: 'sc-muted' }, ' · ' + status.school) : null),
          h('div', { className: 'sc-ykt-actions' },
            h(YktModelPicker, { t: t, models: models, busy: modelBusy, onSave: saveModel }),
            h('button', { type: 'button', className: 'sc-btn', disabled: busy, onClick: function () { loadCourses(); loadModels() } }, t('ykt.refresh')),
            h('button', { type: 'button', className: 'sc-btn', disabled: busy, onClick: logout }, t('ykt.logout')))),
        h('div', { className: 'sc-ykt-toolbar' },
          h('input', {
            className: 'sc-input sc-search',
            type: 'search',
            value: courseQuery,
            placeholder: t('ykt.searchCourse'),
            onChange: function (event) { setCourseQuery(event.target.value) },
          })),
        notice ? h('div', { className: 'sc-ykt-ok', role: 'status' }, notice) : null,
        error ? h('div', { className: 'sc-alert', role: 'alert' }, error) : null,
        busy && !courses.length ? h(LoadingBlock, { text: t('ykt.loading') }) : null,
        !busy && !visibleCourses.length
          ? h('div', { className: 'sc-empty sc-empty-card' }, h('h3', null, t('ykt.noCourses')), h('p', { className: 'sc-muted' }, t('ykt.noCoursesBody')))
          : Object.keys(terms).sort(function (a, b) { return Number(b) - Number(a) }).map(function (term) {
              return h('section', { className: 'sc-ykt-term', key: term },
                h('h4', { className: 'sc-ykt-term-title' }, t('ykt.term', { term: term })),
                h('div', { className: 'sc-ykt-course-grid' }, terms[term].map(function (course) {
                  return h('button', { key: course.classroomId + course.courseId, type: 'button', className: 'sc-ykt-course', onClick: function () { openCourse(course) } },
                    h('span', { className: 'sc-ykt-course-name' }, course.name || '—'),
                    h('span', { className: 'sc-ykt-course-meta' }, [course.className, course.teacher].filter(Boolean).join(' · ')),
                    h('span', { className: 'sc-ykt-course-go' }, t('ykt.openCourse') + ' ›'))
                })))
            })
      )
    }

    function formatYktTime(ms) {
      if (!ms) return '—'
      const value = ms < 1e12 ? ms * 1000 : ms
      const date = new Date(value)
      if (Number.isNaN(date.getTime())) return '—'
      const pad = function (n) { return n < 10 ? '0' + n : String(n) }
      return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate())
    }

    // ------------------------------------------------------------------
    // Main page
    // ------------------------------------------------------------------
    function StudyPage(props) {
      const ctx = props.ctx
      const t = props.t
      const store = useStudyView(ctx)
      const [tab, setTab] = React.useState('review')
      const state = stateFromView(store.view)

      const header = h(
        'header',
        { className: 'sc-header' },
        h(
          'div',
          { className: 'sc-header-main' },
          h('div', { className: 'sc-brand' }, h('div', { className: 'sc-brand-icon' }, h(BookIcon, { size: 20 })), h('div', null, h('h1', { className: 'sc-title' }, t('page.title')), h('p', { className: 'sc-subtitle' }, t('page.subtitle'))))
        ),
        state
          ? h(
              'div',
              { className: 'sc-header-badges' },
              h('span', { className: 'sc-badge sc-badge-accent' }, t('dock.due', { n: computeStats(state, store.view.value && store.view.value.dailyGoal).due })),
              h('span', { className: 'sc-badge' }, h(FlameIcon, { size: 14 }), String(computeStats(state, store.view.value && store.view.value.dailyGoal).streak))
            )
          : null
      )

      let body = null
      if (tab === 'ykt') {
        body = h(YktTab, { t: t, ctx: ctx })
      } else if (store.loading && !state) {
        body = h(LoadingBlock, { text: t('common.loading') })
      } else if (!state) {
        body = h(
          'div',
          { className: 'sc-empty sc-empty-card' },
          h('h3', null, t('common.offline')),
          h('p', null, t('common.offlineBody')),
          h(
            'button',
            { type: 'button', className: 'sc-btn sc-btn-primary', onClick: store.reload },
            t('common.retry')
          )
        )
      } else if (tab === 'review') {
        body = h(ReviewTab, {
          t: t,
          ctx: ctx,
          state: state,
          view: store.view,
          setView: store.setView,
          onGoLibrary: function () { setTab('library') },
        })
      } else if (tab === 'library') {
        body = h(LibraryTab, { t: t, ctx: ctx, state: state, view: store.view, setView: store.setView })
      } else {
        body = h(StatsTab, { t: t, ctx: ctx, state: state, view: store.view, setView: store.setView })
      }

      return h(
        'div',
        { className: 'sc-page' },
        header,
        h(
              'nav',
              { className: 'sc-tabs', role: 'tablist', 'aria-label': t('page.title') },
              ['review', 'library', 'stats', 'ykt'].map(function (key) {
                return h(
                  'button',
                  {
                    key: key,
                    type: 'button',
                    role: 'tab',
                    'aria-selected': tab === key ? 'true' : 'false',
                    className: 'sc-tab',
                    'data-active': tab === key ? '1' : '0',
                    onClick: function () { setTab(key) },
                  },
                  t('tab.' + key)
                )
              })
            ),
        h('div', { className: 'sc-body' }, body)
      )
    }

    // ------------------------------------------------------------------
    // Composer dock pill
    // ------------------------------------------------------------------
    function StudyDock(props) {
      const ctx = props.ctx
      const t = props.t
      const store = useStudyView(ctx)
      const state = stateFromView(store.view)
      const stats = state ? computeStats(state, store.view.value && store.view.value.dailyGoal) : null
      const open = function () {
        const layout = ctx.get('layout')
        if (layout && typeof layout.selectPanel === 'function') {
          try {
            layout.selectPanel('study-coach')
          } catch (error) {
            /* navigation is best effort */
          }
        }
      }
      return h(
        'button',
        {
          type: 'button',
          className: 'sc-dock',
          onClick: open,
          title: t('page.title'),
          'aria-label': t('page.title'),
        },
        h('span', { className: 'sc-dock-icon' }, h(BookIcon, { size: 15 })),
        h('span', { className: 'sc-dock-label' }, t('dock.label')),
        stats
          ? h(
              'span',
              { className: 'sc-dock-badge', 'data-due': stats.due > 0 ? '1' : '0' },
              stats.due > 0 ? t('dock.due', { n: stats.due }) : stats.reviewedToday > 0 ? t('dock.done') : t('dock.start')
            )
          : null
      )
    }

    // ------------------------------------------------------------------
    // Styles
    // ------------------------------------------------------------------
    const CSS = [
      '.sc-page{box-sizing:border-box;display:flex;flex-direction:column;width:100%;height:100%;min-height:0;padding:24px clamp(20px,3.2vw,40px) 36px;overflow:auto;color:var(--dsw-alias-label-primary);font-size:14px;line-height:1.5}',
      '.sc-header{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex:none;margin-bottom:18px}',
      '.sc-header-main{min-width:0}',
      '.sc-brand{display:flex;align-items:center;gap:12px;min-width:0}',
      '.sc-brand-icon{display:flex;align-items:center;justify-content:center;width:38px;height:38px;border-radius:12px;color:var(--dsw-alias-brand-primary);background:color-mix(in srgb,var(--dsw-alias-brand-primary) 12%,var(--dsw-alias-bg-layer-1));flex:none}',
      '.sc-title{margin:0;font-size:22px;line-height:30px;font-weight:650;letter-spacing:.01em}',
      '.sc-subtitle{margin:2px 0 0;font-size:12.5px;line-height:19px;color:var(--dsw-alias-label-tertiary)}',
      '.sc-header-badges{display:flex;align-items:center;gap:8px;flex:none;padding-top:4px}',
      '.sc-badge{display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 10px;border-radius:999px;font-size:12px;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l1)}',
      '.sc-badge-accent{color:var(--dsw-alias-brand-primary);background:color-mix(in srgb,var(--dsw-alias-brand-primary) 10%,var(--dsw-alias-bg-layer-1));border-color:transparent}',
      '.sc-tabs{display:flex;gap:4px;flex:none;margin-bottom:16px;border-bottom:1px solid var(--dsw-alias-border-l1)}',
      '.sc-tab{appearance:none;border:0;background:transparent;padding:9px 14px 10px;font-size:13.5px;font-weight:500;color:var(--dsw-alias-label-secondary);cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-1px;border-radius:8px 8px 0 0}',
      '.sc-tab:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover)}',
      '.sc-tab[data-active="1"]{color:var(--dsw-alias-brand-primary);border-bottom-color:var(--dsw-alias-brand-primary);font-weight:600}',
      '.sc-body{flex:1;min-height:0;display:flex;flex-direction:column}',
      '.sc-center{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;min-height:240px;color:var(--dsw-alias-label-tertiary)}',
      '.sc-spinner{width:22px;height:22px;border-radius:50%;border:2px solid var(--dsw-alias-border-l2);border-top-color:var(--dsw-alias-brand-primary);animation:sc-spin .8s linear infinite}',
      '@keyframes sc-spin{to{transform:rotate(360deg)}}',
      '.sc-muted{color:var(--dsw-alias-label-tertiary);margin:0}',
      '.sc-hint{color:var(--dsw-alias-label-tertiary);font-size:12px;margin:2px 0 0}',
      '.sc-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:28px;text-align:center}',
      '.sc-empty-card{border:1px dashed var(--dsw-alias-border-l2);border-radius:16px;background:var(--dsw-alias-bg-layer-1);min-height:280px}',
      '.sc-empty h3{margin:2px 0 0;font-size:17px;line-height:25px;font-weight:600}',
      '.sc-empty p{max-width:520px;margin:0;color:var(--dsw-alias-label-secondary);font-size:13px}',
      '.sc-empty-icon{display:flex;align-items:center;justify-content:center;width:52px;height:52px;border-radius:50%;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary)}',
      '.sc-empty-icon.sc-tone-success{color:var(--dsw-alias-state-success-primary);background:color-mix(in srgb,var(--dsw-alias-state-success-primary) 14%,var(--dsw-alias-bg-layer-1))}',
      '.sc-empty-actions{display:flex;gap:10px;margin-top:8px}',
      '.sc-start{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;min-height:320px;border:1px solid var(--dsw-alias-border-l1);border-radius:16px;background:var(--dsw-alias-bg-layer-1);padding:36px}',
      '.sc-start h3{margin:0;font-size:19px;font-weight:600}',
      '.sc-start-ring{display:flex;flex-direction:column;align-items:center;justify-content:center;width:120px;height:120px;border-radius:50%;background:color-mix(in srgb,var(--dsw-alias-brand-primary) 8%,var(--dsw-alias-bg-layer-1));border:1px solid color-mix(in srgb,var(--dsw-alias-brand-primary) 26%,transparent)}',
      '.sc-start-number{font-size:38px;line-height:44px;font-weight:650;color:var(--dsw-alias-brand-primary)}',
      '.sc-start-caption{font-size:12px;color:var(--dsw-alias-label-tertiary)}',
      '.sc-btn{appearance:none;display:inline-flex;align-items:center;justify-content:center;gap:6px;height:34px;padding:0 14px;border-radius:9px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font-size:13px;font-weight:500;cursor:pointer;transition:background .12s ease,border-color .12s ease}',
      '.sc-btn:hover{background:var(--dsw-alias-interactive-bg-hover)}',
      '.sc-btn:disabled{opacity:.5;cursor:default}',
      '.sc-btn-primary{background:var(--dsw-alias-button-primary-fill,var(--dsw-alias-brand-primary));border-color:transparent;color:var(--dsw-alias-label-primary-inverted)}',
      '.sc-btn-primary:hover{background:var(--dsw-alias-button-primary-hover,var(--dsw-alias-brand-primary))}',
      '.sc-btn-lg{height:42px;padding:0 22px;font-size:14px;border-radius:11px}',
      '.sc-linkbtn{appearance:none;border:0;background:transparent;color:var(--dsw-alias-label-tertiary);font-size:12px;cursor:pointer;padding:4px 6px;border-radius:6px}',
      '.sc-linkbtn:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover)}',
      '.sc-review{display:flex;flex-direction:column;gap:12px;max-width:820px;width:100%;margin:0 auto}',
      '.sc-review-head{display:flex;align-items:center;justify-content:space-between;font-size:12px}',
      '.sc-progress{height:6px;border-radius:999px;background:var(--dsw-alias-bg-layer-2);overflow:hidden;flex:none}',
      '.sc-progress-fill{height:100%;border-radius:999px;background:var(--dsw-alias-brand-primary);transition:width .2s ease}',
      '.sc-flashcard{display:flex;flex-direction:column;gap:12px;border:1px solid var(--dsw-alias-border-l1);border-radius:18px;background:var(--dsw-alias-bg-layer-1);padding:26px 28px;min-height:220px;box-shadow:0 8px 26px color-mix(in srgb,var(--dsw-alias-label-primary) 5%,transparent)}',
      '.sc-flashcard-label{font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--dsw-alias-label-tertiary)}',
      '.sc-flashcard-front{font-size:22px;line-height:1.55;font-weight:550;white-space:pre-wrap;word-break:break-word}',
      '.sc-flashcard-back{display:flex;flex-direction:column;gap:8px;border-top:1px solid var(--dsw-alias-border-l1);padding-top:14px;animation:sc-fade .16s ease-out}',
      '.sc-flashcard-answer{font-size:15px;line-height:1.7;color:var(--dsw-alias-label-secondary);white-space:pre-wrap;word-break:break-word}',
      '@keyframes sc-fade{from{opacity:0;transform:translateY(3px)}to{opacity:1;transform:none}}',
      '.sc-tagrow{display:flex;flex-wrap:wrap;gap:6px}',
      '.sc-tag{font-size:11px;padding:2px 8px;border-radius:999px;color:var(--dsw-alias-label-tertiary);background:var(--dsw-alias-bg-layer-2)}',
      '.sc-chip{display:inline-flex;align-items:center;height:22px;padding:0 9px;border-radius:999px;font-size:11.5px;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l1);white-space:nowrap}',
      '.sc-grade-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}',
      '.sc-grade{appearance:none;display:flex;flex-direction:column;align-items:center;gap:3px;padding:10px 6px;border-radius:11px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);cursor:pointer;transition:background .12s ease,border-color .12s ease,transform .08s ease}',
      '.sc-grade:hover{background:var(--dsw-alias-interactive-bg-hover);transform:translateY(-1px)}',
      '.sc-grade:disabled{opacity:.5;cursor:default;transform:none}',
      '.sc-grade-label{font-size:13px;font-weight:600}',
      '.sc-grade-hint{font-size:11px;color:var(--dsw-alias-label-tertiary)}',
      '.sc-grade[data-tone="again"]{border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary) 30%,transparent)}',
      '.sc-grade[data-tone="again"] .sc-grade-label{color:var(--dsw-alias-state-error-primary)}',
      '.sc-grade[data-tone="hard"]{border-color:color-mix(in srgb,var(--dsw-static-amber-500) 34%,transparent)}',
      '.sc-grade[data-tone="hard"] .sc-grade-label{color:var(--dsw-alias-state-warn-primary,var(--dsw-static-amber-500))}',
      '.sc-grade[data-tone="good"] .sc-grade-label{color:var(--dsw-alias-brand-primary)}',
      '.sc-grade[data-tone="easy"] .sc-grade-label{color:var(--dsw-alias-state-success-primary)}',
      '.sc-reveal-row{display:flex;align-items:center;gap:14px}',
      '.sc-kbd-hint{font-size:12px;color:var(--dsw-alias-label-tertiary)}',
      '.sc-review-foot{display:flex;justify-content:flex-end}',
      '.sc-alert{padding:9px 12px;border-radius:9px;font-size:12.5px;color:var(--dsw-alias-state-error-primary);background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 9%,var(--dsw-alias-bg-layer-1));border:1px solid color-mix(in srgb,var(--dsw-alias-state-error-primary) 24%,transparent)}',
      '.sc-toolbar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:12px}',
      '.sc-input{box-sizing:border-box;height:34px;padding:0 11px;border-radius:9px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font-size:13px;font-family:inherit;outline:none}',
      '.sc-input:focus{border-color:var(--dsw-alias-brand-primary)}',
      '.sc-search{flex:1;min-width:160px}',
      '.sc-select{min-width:130px}',
      '.sc-textarea{height:auto;padding:9px 11px;line-height:1.55;resize:vertical;min-height:56px}',
      '.sc-form{display:flex;flex-direction:column;gap:8px;border:1px solid var(--dsw-alias-border-l1);border-radius:13px;background:var(--dsw-alias-bg-layer-1);padding:14px;margin-bottom:14px}',
      '.sc-form-actions{display:flex;gap:8px}',
      '.sc-listmeta{font-size:12px;color:var(--dsw-alias-label-tertiary);margin:2px 0 8px}',
      '.sc-cardlist{display:flex;flex-direction:column;gap:8px}',
      '.sc-row{display:flex;align-items:flex-start;gap:12px;padding:13px 14px;border:1px solid var(--dsw-alias-border-l1);border-radius:12px;background:var(--dsw-alias-bg-layer-1)}',
      '.sc-row:hover{border-color:var(--dsw-alias-border-l2)}',
      '.sc-row-main{min-width:0;flex:1;display:flex;flex-direction:column;gap:3px}',
      '.sc-row-front{font-size:14px;font-weight:550;line-height:1.5;word-break:break-word}',
      '.sc-row-back{font-size:12.5px;color:var(--dsw-alias-label-secondary);line-height:1.55;word-break:break-word;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}',
      '.sc-row-meta{display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-size:11.5px;color:var(--dsw-alias-label-tertiary);margin-top:3px}',
      '.sc-row-due[data-due="1"]{color:var(--dsw-alias-brand-primary);font-weight:600}',
      '.sc-row-actions{display:flex;align-items:center;gap:4px;flex:none}',
      '.sc-row-edit{flex:1;display:flex;flex-direction:column;gap:8px}',
      '.sc-iconbtn{appearance:none;display:inline-flex;align-items:center;justify-content:center;min-width:28px;height:28px;padding:0 6px;border-radius:7px;border:0;background:transparent;color:var(--dsw-alias-label-tertiary);cursor:pointer}',
      '.sc-iconbtn:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}',
      '.sc-iconbtn.sc-danger:hover{color:var(--dsw-alias-state-error-primary);background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 10%,transparent)}',
      '.sc-iconbtn[data-confirm="1"]{color:var(--dsw-alias-state-error-primary);font-size:11px}',
      '.sc-confirm-text{white-space:nowrap;font-size:11px}',
      '.sc-stats{display:flex;flex-direction:column;gap:14px;max-width:900px;width:100%;margin:0 auto}',
      '.sc-stat-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}',
      '.sc-stat{padding:14px 16px;border-radius:13px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1)}',
      '.sc-stat-label{font-size:12px;color:var(--dsw-alias-label-tertiary)}',
      '.sc-stat-value{font-size:26px;line-height:34px;font-weight:650;margin-top:2px}',
      '.sc-stat-hint{font-size:11px;color:var(--dsw-alias-label-tertiary)}',
      '.sc-stat[data-tone="warm"] .sc-stat-value{color:var(--dsw-alias-state-warn-primary,var(--dsw-static-amber-500))}',
      '.sc-card{padding:16px 18px;border-radius:14px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1)}',
      '.sc-card-title{margin:0 0 12px;font-size:14px;font-weight:600}',
      '.sc-bars{display:flex;align-items:flex-end;gap:10px;height:150px;padding-top:6px}',
      '.sc-bar-col{flex:1;display:flex;flex-direction:column;align-items:center;gap:6px;height:100%;min-width:0}',
      '.sc-bar-wrap{flex:1;width:100%;max-width:46px;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:4px}',
      '.sc-bar{width:100%;border-radius:6px 6px 3px 3px;background:color-mix(in srgb,var(--dsw-alias-brand-primary) 72%,transparent);min-height:4px;transition:height .2s ease}',
      '.sc-bar-value{font-size:11px;color:var(--dsw-alias-label-tertiary)}',
      '.sc-bar-label{font-size:11px;color:var(--dsw-alias-label-tertiary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}',
      '.sc-mastery{display:flex;flex-direction:column;gap:9px}',
      '.sc-mastery-row{display:grid;grid-template-columns:74px 1fr 36px;align-items:center;gap:10px;font-size:12px}',
      '.sc-mastery-label{color:var(--dsw-alias-label-secondary)}',
      '.sc-mastery-track{height:8px;border-radius:999px;background:var(--dsw-alias-bg-layer-2);overflow:hidden}',
      '.sc-mastery-fill{height:100%;border-radius:999px;background:var(--dsw-alias-label-tertiary)}',
      '.sc-mastery-fill[data-tone="learning"]{background:var(--dsw-alias-brand-primary)}',
      '.sc-mastery-fill[data-tone="mature"]{background:var(--dsw-alias-state-success-primary)}',
      '.sc-mastery-value{text-align:right;color:var(--dsw-alias-label-tertiary)}',
      '.sc-decklist{display:flex;flex-direction:column;gap:8px}',
      '.sc-deckrow{display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:12px;color:var(--dsw-alias-label-tertiary)}',
      '.sc-deckrow-count{text-align:right}',
      '.sc-goalrow{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}',
      '.sc-goalbtn{appearance:none;min-width:48px;height:32px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);font-size:12.5px;cursor:pointer}',
      '.sc-goalbtn:hover{background:var(--dsw-alias-interactive-bg-hover)}',
      '.sc-goalbtn[data-active="1"]{border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-brand-primary);background:color-mix(in srgb,var(--dsw-alias-brand-primary) 10%,var(--dsw-alias-bg-layer-1));font-weight:600}',
      '.sc-ykt-login-tabs{margin-bottom:4px}',
      '.sc-ykt-qr{display:flex;flex-direction:column;align-items:center;gap:8px;padding:8px 0 2px}',
      '.sc-ykt-qr-img{width:220px;height:220px;border-radius:10px;background:#fff;padding:6px;box-sizing:border-box}',
      '.sc-ykt-qr-placeholder{display:flex;align-items:center;justify-content:center;width:220px;height:220px;border-radius:10px;border:1px dashed var(--dsw-alias-border-l2);color:var(--dsw-alias-label-tertiary);background:var(--dsw-alias-bg-layer-2)}',
      '.sc-ykt-login{display:flex;align-items:center;justify-content:center;padding:32px 0}',
      '.sc-ykt-login-card{width:100%;max-width:480px;display:flex;flex-direction:column;gap:12px;padding:26px;border:1px solid var(--dsw-alias-border-l1);border-radius:16px;background:var(--dsw-alias-bg-layer-1)}',
      '.sc-ykt-login-icon{display:flex;align-items:center;justify-content:center;width:52px;height:52px;border-radius:14px;color:var(--dsw-alias-brand-primary);background:color-mix(in srgb,var(--dsw-alias-brand-primary) 10%,var(--dsw-alias-bg-layer-1))}',
      '.sc-ykt-login-title{margin:0;font-size:18px;line-height:26px;font-weight:600}',
      '.sc-ykt-form{display:flex;flex-direction:column;gap:8px;margin-top:4px}',
      '.sc-ykt-label{font-size:12px;color:var(--dsw-alias-label-tertiary);margin-top:4px}',
      '.sc-ykt-help{font-size:11.5px;line-height:1.6;color:var(--dsw-alias-label-tertiary);margin:6px 0 0}',
      '.sc-ykt-ok{font-size:12px;color:var(--dsw-alias-state-success-primary);background:color-mix(in srgb,var(--dsw-alias-state-success-primary) 9%,var(--dsw-alias-bg-layer-1));border:1px solid color-mix(in srgb,var(--dsw-alias-state-success-primary) 22%,transparent);padding:8px 11px;border-radius:8px}',
      '.sc-ykt-courses{display:flex;flex-direction:column;gap:14px;max-width:980px;width:100%;margin:0 auto}',
      '.sc-ykt-statusbar{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}',
      '.sc-ykt-account{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--dsw-alias-label-secondary)}',
      '.sc-ykt-dot{width:8px;height:8px;border-radius:50%;background:var(--dsw-alias-state-success-primary);box-shadow:0 0 0 3px color-mix(in srgb,var(--dsw-alias-state-success-primary) 16%,transparent)}',
      '.sc-ykt-actions{display:flex;gap:8px;align-items:center;flex:none;flex-wrap:wrap;justify-content:flex-end}',
      '.sc-ykt-toolbar{display:flex;gap:8px}',
      '.sc-ykt-term{display:flex;flex-direction:column;gap:8px}',
      '.sc-ykt-term-title{margin:8px 0 0;font-size:12px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:var(--dsw-alias-label-tertiary)}',
      '.sc-ykt-course-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px}',
      '.sc-ykt-course{appearance:none;display:flex;flex-direction:column;align-items:flex-start;gap:4px;text-align:left;padding:14px 16px;border-radius:13px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);cursor:pointer;transition:border-color .12s ease,background .12s ease}',
      '.sc-ykt-course:hover{border-color:var(--dsw-alias-brand-primary);background:var(--dsw-alias-interactive-bg-hover)}',
      '.sc-ykt-course-name{font-size:14.5px;font-weight:600;color:var(--dsw-alias-label-primary)}',
      '.sc-ykt-course-meta{font-size:12px;color:var(--dsw-alias-label-tertiary);line-height:1.5}',
      '.sc-ykt-course-go{margin-top:6px;font-size:12px;color:var(--dsw-alias-brand-primary)}',
      '.sc-ykt-detail{display:flex;flex-direction:column;gap:12px;max-width:980px;width:100%;margin:0 auto}',
      '.sc-ykt-crumbs{display:flex;align-items:center;gap:8px;font-size:12px}',
      '.sc-ykt-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap}',
      '.sc-ykt-title{margin:0;font-size:18px;line-height:26px;font-weight:600}',
      '.sc-ykt-hint{font-size:12px;line-height:1.6;color:var(--dsw-alias-label-tertiary);margin:0}',
      '.sc-ykt-chips{display:flex;gap:6px;flex-wrap:wrap}',
      '.sc-ykt-chip{appearance:none;height:28px;padding:0 11px;border-radius:999px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);font-size:12px;cursor:pointer}',
      '.sc-ykt-chip[data-active="1"]{border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-brand-primary);background:color-mix(in srgb,var(--dsw-alias-brand-primary) 10%,var(--dsw-alias-bg-layer-1))}',
      '.sc-ykt-subtabs{display:flex;gap:4px;border-bottom:1px solid var(--dsw-alias-border-l1)}',
      '.sc-ykt-subtab{appearance:none;border:0;background:transparent;padding:8px 12px 9px;font-size:13px;color:var(--dsw-alias-label-secondary);cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-1px}',
      '.sc-ykt-subtab[data-active="1"]{color:var(--dsw-alias-brand-primary);border-bottom-color:var(--dsw-alias-brand-primary);font-weight:600}',
      '.sc-ykt-list{display:flex;flex-direction:column;gap:7px}',
      '.sc-ykt-row{appearance:none;display:flex;align-items:center;gap:12px;text-align:left;padding:12px 14px;border-radius:11px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);cursor:pointer}',
      '.sc-ykt-row:hover{border-color:var(--dsw-alias-border-l2);background:var(--dsw-alias-interactive-bg-hover)}',
      '.sc-ykt-row-main{display:flex;flex-direction:column;gap:3px;min-width:0;flex:1}',
      '.sc-ykt-row-title{font-size:13.5px;font-weight:550;color:var(--dsw-alias-label-primary);word-break:break-word}',
      '.sc-ykt-row-meta{font-size:11.5px;color:var(--dsw-alias-label-tertiary)}',
      '.sc-ykt-chevron{font-size:18px;color:var(--dsw-alias-label-tertiary);flex:none}',
      '.sc-ykt-progress-row{display:flex;align-items:center;gap:12px;padding:11px 14px;border-radius:11px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1)}',
      '.sc-ykt-progress-score{font-size:12px;color:var(--dsw-alias-label-secondary);white-space:nowrap}',
      '.sc-ykt-slides{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px}',
      '.sc-ykt-pickbar{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:8px 12px;border-radius:12px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1)}',
      '.sc-ykt-pickbar-text{display:flex;flex-direction:column;gap:2px;min-width:0}',
      '.sc-ykt-pickbar-count{display:block;font-size:13px;font-weight:600}',
      '.sc-ykt-pickbar-text .sc-ykt-hint{display:block;margin:0}',
      '.sc-ykt-pickbar-actions{display:flex;gap:6px;flex-wrap:wrap}',
      '.sc-ykt-slide-pick{position:absolute;left:8px;top:8px;z-index:2;display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:8px;background:color-mix(in srgb,var(--dsw-alias-bg-layer-1) 88%,transparent);box-shadow:0 1px 3px rgba(0,0,0,.18);cursor:pointer}',
      '.sc-ykt-slide-pick input{width:16px;height:16px;margin:0;cursor:pointer;accent-color:var(--dsw-alias-button-primary-fill,var(--dsw-alias-brand-primary))}',
      '.sc-ykt-slide[data-excluded="1"] .sc-ykt-slide-open img{opacity:.38;filter:grayscale(1)}',
      '.sc-ykt-slide[data-excluded="1"]{border-style:dashed}',
      '.sc-ykt-slide-off{color:var(--dsw-alias-label-tertiary)}',
      '.sc-ykt-slide{margin:0;display:flex;flex-direction:column;gap:5px;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;overflow:hidden;background:var(--dsw-alias-bg-layer-1)}',
      '.sc-ykt-slide img{display:block;width:100%;height:auto;background:var(--dsw-alias-bg-layer-2)}',
      '.sc-ykt-slide figcaption{font-size:11px;color:var(--dsw-alias-label-tertiary);padding:0 8px 7px}',
      '.sc-ykt-slide-empty{display:flex;align-items:center;justify-content:center;min-height:100px;color:var(--dsw-alias-label-tertiary)}',
      '.sc-btn-sm{height:28px;padding:0 10px;font-size:12px;border-radius:7px}',
      '.sc-ykt-row-actions{padding:7px 8px 7px 6px;gap:8px}',
      '.sc-ykt-row-hit{appearance:none;display:flex;align-items:center;gap:12px;flex:1;min-width:0;text-align:left;border:0;background:transparent;color:inherit;padding:5px 6px;border-radius:8px;cursor:pointer;font:inherit}',
      '.sc-ykt-row-hit:hover{background:var(--dsw-alias-interactive-bg-hover)}',
      '.sc-ykt-modelp{display:inline-flex;align-items:center;gap:6px;min-width:0}',
      '.sc-ykt-modelp-label{font-size:11.5px;color:var(--dsw-alias-label-tertiary);white-space:nowrap}',
      '.sc-ykt-modelp-select{max-width:190px;height:30px;font-size:12px}',
      '.sc-ykt-modelp-error{display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;border-radius:50%;font-size:11px;font-weight:700;color:var(--dsw-alias-state-error-primary);background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 12%,var(--dsw-alias-bg-layer-1))}',
      '.sc-ykt-slide{position:relative}',
      '.sc-ykt-slide-open{appearance:none;display:block;padding:0;border:0;background:transparent;cursor:zoom-in;position:relative;width:100%}',
      '.sc-ykt-slide-open img{display:block;width:100%;height:auto;background:var(--dsw-alias-bg-layer-2)}',
      '.sc-ykt-slide-zoom{position:absolute;right:7px;top:7px;display:flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:7px;background:color-mix(in srgb,var(--dsw-alias-label-primary) 55%,transparent);color:var(--dsw-alias-label-primary-inverted);font-size:13px;opacity:0;transition:opacity .12s ease}',
      '.sc-ykt-slide:hover .sc-ykt-slide-zoom{opacity:1}',
      '.sc-ykt-summary{display:flex;flex-direction:column;gap:12px;border:1px solid var(--dsw-alias-border-l1);border-radius:14px;background:var(--dsw-alias-bg-layer-1);padding:16px 18px}',
      '.sc-ykt-summary-empty{background:color-mix(in srgb,var(--dsw-alias-brand-primary) 4%,var(--dsw-alias-bg-layer-1));border-style:dashed}',
      '.sc-ykt-summary-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap}',
      '.sc-ykt-summary-heading{min-width:0}',
      '.sc-ykt-summary-title{margin:0;font-size:16px;line-height:24px;font-weight:650}',
      '.sc-ykt-summary-meta{margin:2px 0 0;font-size:11.5px;color:var(--dsw-alias-label-tertiary)}',
      '.sc-ykt-summary-actions{display:flex;gap:6px;flex-wrap:wrap}',
      '.sc-ykt-summary-overview{margin:0;font-size:13.5px;line-height:1.7;color:var(--dsw-alias-label-secondary);white-space:pre-wrap}',
      '.sc-ykt-warn{margin:0;font-size:12px;line-height:1.6;color:var(--dsw-alias-state-warn-primary,var(--dsw-static-amber-500));background:color-mix(in srgb,var(--dsw-static-amber-500) 9%,var(--dsw-alias-bg-layer-1));border:1px solid color-mix(in srgb,var(--dsw-static-amber-500) 22%,transparent);border-radius:8px;padding:7px 9px}',
      '.sc-ykt-summary-section{display:flex;flex-direction:column;gap:7px;border-top:1px solid var(--dsw-alias-border-l1);padding-top:11px}',
      '.sc-ykt-summary-subtitle{margin:0;font-size:12px;font-weight:650;letter-spacing:.04em;color:var(--dsw-alias-label-tertiary);text-transform:uppercase}',
      '.sc-ykt-kp,.sc-ykt-exam,.sc-ykt-pitfalls{margin:0;padding-left:20px;display:flex;flex-direction:column;gap:8px}',
      '.sc-ykt-kp-item,.sc-ykt-exam-item{font-size:13px;line-height:1.6}',
      '.sc-ykt-kp-head{display:flex;align-items:baseline;gap:7px;flex-wrap:wrap}',
      '.sc-ykt-imp{display:inline-flex;align-items:center;height:18px;padding:0 6px;border-radius:5px;font-size:10.5px;font-weight:650;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary)}',
      '.sc-ykt-imp[data-level="high"]{background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 12%,var(--dsw-alias-bg-layer-1));color:var(--dsw-alias-state-error-primary)}',
      '.sc-ykt-imp[data-level="medium"]{background:color-mix(in srgb,var(--dsw-alias-brand-primary) 12%,var(--dsw-alias-bg-layer-1));color:var(--dsw-alias-brand-primary)}',
      '.sc-ykt-kp-name{font-weight:600}',
      '.sc-ykt-kp-page{font-size:11px;color:var(--dsw-alias-label-tertiary)}',
      '.sc-ykt-kp-detail{margin:2px 0 0;font-size:12.5px;line-height:1.65;color:var(--dsw-alias-label-secondary);white-space:pre-wrap}',
      '.sc-ykt-exam-name{font-weight:600}',
      '.sc-ykt-exam-line{margin:2px 0 0;font-size:12.5px;line-height:1.6;color:var(--dsw-alias-label-secondary);white-space:pre-wrap}',
      '.sc-ykt-exam-how{color:var(--dsw-alias-label-tertiary)}',
      '.sc-ykt-pitfalls li{font-size:12.5px;line-height:1.6;color:var(--dsw-alias-label-secondary)}',
      '.sc-ykt-plan{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:8px}',
      '.sc-ykt-plan-step{border:1px solid var(--dsw-alias-border-l1);border-radius:10px;padding:10px 12px;background:var(--dsw-alias-bg-layer-2)}',
      '.sc-ykt-plan-title{font-size:12.5px;font-weight:600}',
      '.sc-ykt-plan-list{margin:6px 0 0;padding-left:18px;font-size:12px;line-height:1.6;color:var(--dsw-alias-label-secondary)}',
      '.sc-ykt-summary-progress-text{margin:0;font-size:11.5px;color:var(--dsw-alias-label-tertiary)}',
      '.sc-ykt-viewer{position:fixed;inset:0;z-index:9999;box-sizing:border-box;display:flex;flex-direction:column;font-size:14px;line-height:1.5;background:color-mix(in srgb,var(--dsw-static-neutral-1000) 92%,transparent);color:var(--dsw-static-neutral-00);-webkit-app-region:no-drag}',
      // DSH desktop draws native window buttons (titleBarOverlay, 40px) over the
      // top-right corner and marks the whole top strip as a window-drag region,
      // which swallows clicks. Keep the viewer chrome below that strip.
      '.sc-ykt-viewer-caption{flex:none;height:0}',
      'html[data-windows-titlebar] .sc-ykt-viewer-caption{height:var(--dsh-windows-titlebar-height,40px);-webkit-app-region:drag}',
      'html[data-platform="darwin"] .sc-ykt-viewer-caption{height:40px;-webkit-app-region:drag}',
      'html[data-fullscreen] .sc-ykt-viewer-caption{height:0}',
      '.sc-ykt-viewer-head,.sc-ykt-viewer-hint,.sc-ykt-viewer-body,.sc-ykt-viewer button,.sc-ykt-viewer select,.sc-ykt-viewer textarea,.sc-ykt-viewer canvas{-webkit-app-region:no-drag}',
      '.sc-ykt-viewer-head{display:flex;align-items:center;gap:14px;flex-wrap:wrap;padding:10px 14px;border-bottom:1px solid color-mix(in srgb,var(--dsw-static-neutral-00) 14%,transparent);background:color-mix(in srgb,var(--dsw-static-neutral-1000) 84%,transparent);flex:none}',
      '.sc-ykt-viewer-hint{padding:4px 14px;text-align:center;font-size:11px;line-height:1.5;color:color-mix(in srgb,var(--dsw-static-neutral-00) 68%,transparent);background:color-mix(in srgb,var(--dsw-static-neutral-1000) 88%,transparent);flex:none}',
      '.sc-ykt-viewer-title{display:flex;align-items:center;gap:9px;min-width:0;flex:1}',
      '.sc-ykt-viewer-title strong{font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:36vw}',
      '.sc-ykt-viewer-page{font-size:11.5px;opacity:.72;white-space:nowrap}',
      '.sc-ykt-viewer-tools{display:flex;align-items:center;gap:3px;flex:none;flex-wrap:wrap}',
      '.sc-ykt-tool{appearance:none;height:28px;padding:0 9px;border-radius:7px;border:1px solid transparent;background:transparent;color:inherit;font-size:12px;cursor:pointer;opacity:.82}',
      '.sc-ykt-tool:hover{background:color-mix(in srgb,var(--dsw-static-neutral-00) 12%,transparent);opacity:1}',
      '.sc-ykt-tool[data-active="1"]{border-color:color-mix(in srgb,var(--dsw-static-neutral-00) 32%,transparent);background:color-mix(in srgb,var(--dsw-static-neutral-00) 16%,transparent);font-weight:600;opacity:1}',
      '.sc-ykt-viewer-sep{width:1px;height:18px;background:color-mix(in srgb,var(--dsw-static-neutral-00) 18%,transparent);margin:0 4px}',
      '.sc-ykt-viewer-right{display:flex;align-items:center;gap:8px;flex:none}',
      '.sc-ykt-viewer-right .sc-ykt-modelp-label{color:inherit;opacity:.7}',
      '.sc-ykt-viewer-close{height:30px;padding:0 10px;background:transparent;color:inherit;border-color:color-mix(in srgb,var(--dsw-static-neutral-00) 24%,transparent)}',
      '.sc-ykt-viewer-body{display:flex;flex:1;min-height:0}',
      '.sc-ykt-viewer-stage{position:relative;flex:1;min-width:0;display:flex;align-items:center;justify-content:center;overflow:hidden;background:color-mix(in srgb,var(--dsw-static-neutral-1000) 94%,transparent);touch-action:none}',
      '.sc-ykt-viewer-canvasbox{position:relative;flex:none;box-shadow:0 8px 40px rgba(0,0,0,.5);background:#fff;will-change:transform}',
      '.sc-ykt-viewer-canvasbox img{display:block;user-select:none;pointer-events:none;position:relative;z-index:1}',
      '.sc-ykt-anno{position:absolute;inset:0;display:block;touch-action:none;pointer-events:auto;z-index:2}',
      '.sc-ykt-viewer-noimg{display:flex;align-items:center;justify-content:center;width:100%;height:100%;color:#888}',
      '.sc-ykt-viewer-nav{position:absolute;left:50%;bottom:10px;transform:translateX(-50%);display:flex;align-items:center;gap:10px;padding:5px 9px;border-radius:999px;background:color-mix(in srgb,var(--dsw-static-neutral-1000) 72%,transparent);color:var(--dsw-static-neutral-00);font-size:12px}',
      '.sc-ykt-viewer-navbtn{appearance:none;width:28px;height:28px;border-radius:50%;border:0;background:color-mix(in srgb,var(--dsw-static-neutral-00) 14%,transparent);color:inherit;font-size:18px;line-height:1;cursor:pointer}',
      '.sc-ykt-viewer-navbtn:disabled{opacity:.3;cursor:default}',
      '.sc-ykt-viewer-zoom{position:absolute;right:10px;bottom:10px;display:flex;align-items:center;gap:6px;padding:5px 8px;border-radius:999px;background:color-mix(in srgb,var(--dsw-static-neutral-1000) 72%,transparent);color:var(--dsw-static-neutral-00);font-size:11.5px}',
      '.sc-ykt-chat{width:360px;max-width:44vw;flex:none;display:flex;flex-direction:column;gap:8px;padding:12px 12px 14px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);border-left:1px solid var(--dsw-alias-border-l1);min-height:0}',
      '.sc-ykt-chat-head{display:flex;align-items:center;justify-content:space-between;gap:8px;flex:none}',
      '.sc-ykt-chat-head strong{font-size:13px;font-weight:650}',
      '.sc-ykt-chat-anno{font-size:11px;color:var(--dsw-alias-brand-primary);background:color-mix(in srgb,var(--dsw-alias-brand-primary) 9%,var(--dsw-alias-bg-layer-1));border-radius:7px;padding:5px 8px;flex:none}',
      '.sc-ykt-chat-list{flex:1;min-height:0;overflow:auto;display:flex;flex-direction:column;gap:8px;padding:4px 1px;border-top:1px solid var(--dsw-alias-border-l1);border-bottom:1px solid var(--dsw-alias-border-l1)}',
      '.sc-ykt-chat-empty{margin:8px 0;font-size:12px;line-height:1.6;color:var(--dsw-alias-label-tertiary)}',
      '.sc-ykt-msg{display:flex}',
      '.sc-ykt-msg[data-role="user"]{justify-content:flex-end}',
      '.sc-ykt-msg-bubble{max-width:92%;padding:8px 10px;border-radius:10px;font-size:12.5px;line-height:1.62;white-space:pre-wrap;word-break:break-word;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}',
      '.sc-ykt-msg[data-role="user"] .sc-ykt-msg-bubble{background:var(--dsw-alias-brand-primary);color:var(--dsw-alias-label-primary-inverted)}',
      '.sc-ykt-msg-bubble.sc-md{white-space:normal;display:flex;flex-direction:column;gap:8px;min-width:0}',
      '.sc-md>*{margin:0}',
      '.sc-md-p{margin:0;line-height:1.7}',
      '.sc-md-h{font-weight:600;line-height:1.4;margin:4px 0 0}',
      '.sc-md-h1,.sc-md-h2{font-size:15px}',
      '.sc-md-h3{font-size:14px}',
      '.sc-md-h4{font-size:13px}',
      '.sc-md-list{margin:0;padding-left:20px;display:flex;flex-direction:column;gap:4px;line-height:1.7}',
      '.sc-md-list .sc-md-list{margin-top:4px}',
      '.sc-md-quote{margin:0;padding:4px 0 4px 12px;border-left:2px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-secondary)}',
      '.sc-md-hr{width:100%;border:0;border-top:1px solid var(--dsw-alias-border-l1);margin:4px 0}',
      '.sc-md-code{font-family:"SF Mono",ui-monospace,Menlo,Consolas,monospace;font-size:.92em;padding:1px 5px;border-radius:6px;background:color-mix(in srgb,var(--dsw-alias-label-primary) 7%,transparent)}',
      '.sc-md-pre{margin:0;padding:10px 12px;border-radius:10px;overflow:auto;font-family:"SF Mono",ui-monospace,Menlo,Consolas,monospace;font-size:12px;line-height:1.55;background:color-mix(in srgb,var(--dsw-alias-label-primary) 6%,transparent);white-space:pre}',
      '.sc-md-table-wrap{max-width:100%;overflow-x:auto}',
      '.sc-md-table{border-collapse:collapse;font-size:12px;line-height:1.5}',
      '.sc-md-table th,.sc-md-table td{padding:4px 8px;border:1px solid var(--dsw-alias-border-l1);text-align:left;vertical-align:top}',
      '.sc-md-table th{font-weight:600;background:color-mix(in srgb,var(--dsw-alias-label-primary) 4%,transparent)}',
      '.sc-math{font-family:"Cambria Math","STIX Two Math","Latin Modern Math","Times New Roman",math,serif}',
      '.sc-math math{font-size:1.12em}',
      '.sc-math-block{max-width:100%;overflow-x:auto;overflow-y:hidden;padding:4px 0;text-align:center}',
      '.sc-math-block math{font-size:1.2em}',
      '.sc-ykt-chat-thinking{font-size:12px;color:var(--dsw-alias-label-tertiary)}',
      '.sc-ykt-chat-quick{display:flex;gap:5px;flex-wrap:wrap;flex:none}',
      '.sc-ykt-chat-input{display:flex;gap:6px;align-items:flex-end;flex:none}',
      '.sc-ykt-chat-textarea{flex:1;min-height:54px;max-height:130px;resize:vertical;font-size:12.5px}',
      // Knowledge board: a pegboard (dot-hole grid) with each tree pinned on as a card.
      '.sc-kb{display:flex;flex-direction:column;gap:10px;margin:2px 0 14px}',
      '.sc-kb-head{display:flex;align-items:center;gap:10px;flex-wrap:wrap}',
      '.sc-kb-title{margin:0;font-size:15px;font-weight:650}',
      '.sc-kb-stats{font-size:12px;color:var(--dsw-alias-label-tertiary)}',
      '.sc-kb-live{display:inline-flex;align-items:center;gap:6px;font-size:11.5px;color:var(--dsw-alias-brand-primary)}',
      '.sc-kb-live::before{content:"";width:7px;height:7px;border-radius:50%;background:var(--dsw-alias-brand-primary);animation:sc-kb-pulse 1.2s ease-in-out infinite}',
      '.sc-kb-spacer{flex:1}',
      '.sc-kb-pegboard{--sc-kb-hole:color-mix(in srgb,var(--dsw-alias-label-primary) 15%,transparent);--sc-kb-line:color-mix(in srgb,var(--dsw-alias-label-primary) 16%,transparent);position:relative;display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:22px 18px;align-items:start;padding:26px 20px 22px;border-radius:14px;border:1px solid var(--dsw-alias-border-l1);background-color:color-mix(in srgb,var(--dsw-alias-bg-layer-2) 90%,#b08a5a 10%);background-image:radial-gradient(circle at center,var(--sc-kb-hole) 0 2.2px,transparent 2.9px);background-size:22px 22px;background-position:11px 11px;box-shadow:inset 0 1px 4px rgba(0,0,0,.08);max-height:560px;overflow:auto}',
      '.sc-kb[data-tall="1"] .sc-kb-pegboard{max-height:none}',
      '.sc-kb-pegboard-empty{display:flex;align-items:center;justify-content:center;min-height:150px}',
      '.sc-kb-empty{margin:0;font-size:12.5px;color:var(--dsw-alias-label-tertiary);text-align:center}',
      '.sc-kb-tree{position:relative;min-width:0;padding:20px 14px 14px;border-radius:12px;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);box-shadow:0 6px 18px rgba(0,0,0,.09);animation:sc-kb-pop .32s ease both}',
      '.sc-kb-tree::before,.sc-kb-tree::after{content:"";position:absolute;top:7px;width:9px;height:9px;border-radius:50%;background:radial-gradient(circle at 35% 35%,#fff 0 1px,#9aa3ad 2px,#5f6872 100%);box-shadow:0 1px 2px rgba(0,0,0,.35)}',
      '.sc-kb-tree::before{left:12px}',
      '.sc-kb-tree::after{right:12px}',
      '.sc-kb-tree-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:0 0 10px;padding:0 6px;font-size:13.5px}',
      '.sc-kb-tree-head strong{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.sc-kb-tree-count{flex:none;font-size:11px;padding:1px 7px;border-radius:999px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-tertiary)}',
      '.sc-kb-roots,.sc-kb-children{list-style:none;margin:0;padding:0}',
      '.sc-kb-children{margin-left:9px;padding-left:12px;border-left:1.5px solid var(--sc-kb-line)}',
      '.sc-kb-item{position:relative;margin:3px 0;animation:sc-kb-pop .28s ease both}',
      '.sc-kb-children>.sc-kb-item::before{content:"";position:absolute;left:-12px;top:13px;width:10px;border-top:1.5px solid var(--sc-kb-line)}',
      '.sc-kb-row{display:flex;align-items:center;gap:4px;min-width:0}',
      '.sc-kb-toggle{appearance:none;flex:none;width:18px;height:18px;padding:0;display:inline-flex;align-items:center;justify-content:center;border:0;border-radius:5px;background:transparent;color:var(--dsw-alias-label-tertiary);font-size:11px;cursor:pointer}',
      '.sc-kb-toggle:hover{background:var(--dsw-alias-interactive-bg-hover)}',
      '.sc-kb-toggle-leaf{cursor:default;opacity:.5}',
      '.sc-kb-toggle-leaf:hover{background:transparent}',
      '.sc-kb-node{appearance:none;display:inline-flex;align-items:center;gap:6px;min-width:0;max-width:100%;padding:4px 10px;border-radius:999px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font:inherit;font-size:12.5px;line-height:1.35;text-align:left;cursor:pointer;transition:box-shadow .2s ease,border-color .2s ease}',
      '.sc-kb-node:hover{border-color:color-mix(in srgb,var(--dsw-alias-brand-primary) 45%,transparent)}',
      '.sc-kb-node[data-imp="high"]{font-weight:600;border-color:color-mix(in srgb,var(--dsw-alias-brand-primary) 55%,transparent);background:color-mix(in srgb,var(--dsw-alias-brand-primary) 12%,var(--dsw-alias-bg-layer-1))}',
      '.sc-kb-node[data-imp="low"]{color:var(--dsw-alias-label-secondary);background:transparent;border-style:dashed}',
      '.sc-kb-node[data-selected="1"]{box-shadow:0 0 0 2px color-mix(in srgb,var(--dsw-alias-brand-primary) 45%,transparent)}',
      '.sc-kb-node[data-fresh="1"]{animation:sc-kb-glow 1.6s ease-out}',
      '.sc-kb-label{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.sc-kb-pages,.sc-kb-count{flex:none;font-size:10.5px;font-weight:400;color:var(--dsw-alias-label-tertiary)}',
      '.sc-kb-detail{margin:5px 0 4px 22px;padding:8px 10px;border-radius:9px;background:var(--dsw-alias-bg-layer-2);font-size:12px;line-height:1.6;color:var(--dsw-alias-label-secondary)}',
      '.sc-kb-detail p{margin:0 0 6px}',
      '.sc-kb-detail-meta{display:flex;align-items:center;gap:5px;flex-wrap:wrap}',
      '.sc-kb-imp{font-size:11px;padding:1px 7px;border-radius:999px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-tertiary)}',
      '.sc-kb-imp[data-imp="high"]{color:var(--dsw-alias-brand-primary)}',
      '.sc-kb-page{height:24px;font-size:11px}',
      // Board layout: pegboard + optional Q&A panel; flex-wrap stacks them when narrow.
      '.sc-kb-body{display:flex;flex-wrap:wrap;gap:14px;align-items:stretch}',
      '.sc-kb-body>.sc-kb-pegboard{flex:999 1 420px;min-width:0}',
      '.sc-kb-tip{font-size:11.5px;color:var(--dsw-alias-label-tertiary)}',
      '.sc-kb-node[data-asking="1"]{border-color:var(--dsw-alias-brand-primary);box-shadow:0 0 0 2px color-mix(in srgb,var(--dsw-alias-brand-primary) 30%,transparent)}',
      '.sc-kb-asked{flex:none;font-size:10px;opacity:.75}',
      '.sc-kb-askbtn{color:var(--dsw-alias-brand-primary);border-color:color-mix(in srgb,var(--dsw-alias-brand-primary) 40%,transparent)}',
      '.sc-kb-chat{flex:1 1 300px;max-width:420px;min-width:0;max-height:560px;display:flex;flex-direction:column;gap:8px;padding:12px;border-radius:14px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);box-shadow:0 6px 18px rgba(0,0,0,.06);animation:sc-kb-pop .2s ease both}',
      '.sc-kb[data-tall="1"] .sc-kb-chat{max-height:none}',
      '.sc-kb-chat-head{display:flex;align-items:flex-start;justify-content:space-between;gap:8px;flex:none}',
      '.sc-kb-chat-tools{display:flex;align-items:center;gap:4px;flex:none}',
      '.sc-ykt-chatstore{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}',
      '.sc-ykt-chatstore .sc-ykt-hint{margin:0;flex:1 1 280px;min-width:0}',
      '.sc-kb-chat-heading{display:flex;flex-direction:column;gap:2px;min-width:0}',
      '.sc-kb-chat-heading strong{font-size:13px;font-weight:650;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.sc-kb-chat-path{font-size:11px;color:var(--dsw-alias-label-tertiary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.sc-kb-chat-list{min-height:120px}',
      '.sc-kb-copied{align-self:flex-start}',
      '.sc-kb-menu{position:fixed;z-index:10000;box-sizing:border-box;padding:6px;border-radius:11px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);box-shadow:0 12px 32px rgba(0,0,0,.18);font-size:13px;line-height:1.4;-webkit-app-region:no-drag;animation:sc-kb-pop .12s ease both}',
      '.sc-kb-menu-title{padding:4px 8px 6px;font-size:11.5px;color:var(--dsw-alias-label-tertiary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.sc-kb-menu-item{appearance:none;display:block;width:100%;height:32px;padding:0 10px;border:0;border-radius:7px;background:transparent;color:inherit;font:inherit;text-align:left;cursor:pointer;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.sc-kb-menu-item:hover,.sc-kb-menu-item:focus-visible{background:var(--dsw-alias-interactive-bg-hover);outline:none}',
      '.sc-kb-menu-minor{color:var(--dsw-alias-label-secondary)}',
      '.sc-kb-menu-sep{height:1px;margin:5px 6px;background:var(--dsw-alias-border-l1)}',
      '@media (prefers-reduced-motion: reduce){.sc-kb-chat,.sc-kb-menu{animation:none!important}}',
      '@keyframes sc-kb-pop{from{opacity:0;transform:translateY(-4px) scale(.97)}to{opacity:1;transform:none}}',
      '@keyframes sc-kb-glow{0%{box-shadow:0 0 0 5px color-mix(in srgb,var(--dsw-alias-brand-primary) 40%,transparent)}100%{box-shadow:0 0 0 0 transparent}}',
      '@keyframes sc-kb-pulse{0%,100%{opacity:.35}50%{opacity:1}}',
      '@media (prefers-reduced-motion: reduce){.sc-kb-tree,.sc-kb-item,.sc-kb-node,.sc-kb-live::before{animation:none!important}}',
      '.sc-dock{appearance:none;display:inline-flex;align-items:center;align-self:center;gap:8px;height:28px;padding:0 12px;margin:0 auto;max-width:max-content;border-radius:999px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);font-size:12px;cursor:pointer;opacity:.9;transition:background .12s ease,opacity .12s ease}',
      '.sc-dock:hover{background:var(--dsw-alias-interactive-bg-hover);opacity:1}',
      '.sc-dock-icon{display:flex;color:var(--dsw-alias-brand-primary)}',
      '.sc-dock-label{font-weight:500;color:var(--dsw-alias-label-secondary)}',
      '.sc-dock-badge{display:inline-flex;align-items:center;height:20px;padding:0 8px;border-radius:999px;font-size:11px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-tertiary)}',
      '.sc-dock-badge[data-due="1"]{color:var(--dsw-alias-brand-primary);background:color-mix(in srgb,var(--dsw-alias-brand-primary) 12%,var(--dsw-alias-bg-layer-2));font-weight:600}',
      '@media (max-width: 720px){.sc-stat-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.sc-grade-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.sc-title{font-size:19px}.sc-subtitle{display:none}}',
    ].join('\n')

    // ------------------------------------------------------------------
    // Apple theme layer
    // ------------------------------------------------------------------
    // Appended after CSS. Every plugin surface draws from the host's
    // --dsw-alias-* variables, so the theme rebinds those variables inside the
    // plugin roots (pale-gray canvas, white cards, a single Apple blue, SF Pro)
    // and then restyles shape only: capsule buttons, segmented tabs, 18px cards,
    // frosted chrome. Geometry (heights/paddings) is left alone on purpose so
    // the existing layouts keep their measurements. Light/dark follows the host
    // via html[data-sc-theme], set by syncHostTheme() below.
    const SC_ROOTS = ['.sc-page', '.sc-ykt-viewer', '.sc-kb-menu', '.sc-dock']
    const scRoots = function (prefix) {
      return SC_ROOTS.map(function (root) { return (prefix ? prefix + ' ' : '') + root }).join(',')
    }
    const APPLE_CSS = [
      scRoots('') + '{' +
        /* Apple tokens — light */
        '--sc-canvas:#f5f5f7;--sc-card:#ffffff;--sc-fill:#ececf0;' +
        '--sc-fg:#1d1d1f;--sc-fg-2:#424245;--sc-muted:#6e6e73;--sc-meta:#86868b;' +
        '--sc-border:#d2d2d7;--sc-border-soft:#e8e8ed;' +
        '--sc-accent-fill:#0071e3;--sc-accent-hover:#0077ed;--sc-accent-active:#0066cc;--sc-accent-text:#0066cc;--sc-on-accent:#ffffff;' +
        '--sc-danger:#d70015;--sc-success:#248a3d;--sc-warn:#b25000;' +
        '--sc-elev-raised:0 12px 32px rgba(0,0,0,.08);' +
        '--sc-focus-ring:0 0 0 4px color-mix(in srgb,var(--sc-accent-fill) 35%,transparent);' +
        '--sc-radius-pill:980px;--sc-radius-card:18px;--sc-radius-field:10px;' +
        '--sc-ease:cubic-bezier(.28,0,.22,1);--sc-fast:150ms;--sc-base:220ms;' +
        '--sc-font-display:"SF Pro Display","SF Pro Icons","PingFang SC","Helvetica Neue",Helvetica,Arial,"Microsoft YaHei",sans-serif;' +
        '--sc-font-text:"SF Pro Text","SF Pro Icons","PingFang SC","Helvetica Neue",Helvetica,Arial,"Microsoft YaHei",sans-serif;' +
        /* host aliases rebound to Apple tokens */
        '--dsw-alias-bg-layer-1:var(--sc-card);--dsw-alias-bg-layer-2:var(--sc-fill);' +
        '--dsw-alias-label-primary:var(--sc-fg);--dsw-alias-label-secondary:var(--sc-fg-2);--dsw-alias-label-tertiary:var(--sc-muted);--dsw-alias-label-primary-inverted:var(--sc-on-accent);' +
        '--dsw-alias-border-l1:var(--sc-border-soft);--dsw-alias-border-l2:var(--sc-border);' +
        '--dsw-alias-brand-primary:var(--sc-accent-text);--dsw-alias-button-primary-fill:var(--sc-accent-fill);--dsw-alias-button-primary-hover:var(--sc-accent-hover);' +
        '--dsw-alias-interactive-bg-hover:color-mix(in srgb,var(--sc-fg) 5%,transparent);' +
        '--dsw-alias-state-error-primary:var(--sc-danger);--dsw-alias-state-success-primary:var(--sc-success);--dsw-alias-state-warn-primary:var(--sc-warn);' +
        'font-family:var(--sc-font-text);-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}',
      scRoots('html[data-sc-theme="dark"]') + '{' +
        /* Apple dark chapter: black canvas, graphite steps, bright link blue */
        '--sc-canvas:#000000;--sc-card:#1c1c1e;--sc-fill:#2c2c2e;' +
        '--sc-fg:#f5f5f7;--sc-fg-2:#d2d2d7;--sc-muted:#a1a1a6;--sc-meta:#86868b;' +
        '--sc-border:#424245;--sc-border-soft:#333336;' +
        '--sc-accent-text:#2997ff;--sc-danger:#ff6961;--sc-success:#30d158;--sc-warn:#ffb340;' +
        '--sc-elev-raised:0 12px 32px rgba(0,0,0,.5);' +
        '--dsw-alias-interactive-bg-hover:color-mix(in srgb,var(--sc-fg) 8%,transparent)}',

      // Canvas + type
      '.sc-page{background:var(--sc-canvas);letter-spacing:-0.01em}',
      '.sc-title,.sc-ykt-title,.sc-ykt-summary-title,.sc-ykt-login-title,.sc-card-title,.sc-stat-value,.sc-start-number,.sc-start h3,.sc-flashcard-front,.sc-kb-title{font-family:var(--sc-font-display);letter-spacing:-0.015em}',
      '.sc-title{font-size:28px;line-height:1.14;font-weight:600}',
      '.sc-stat-value,.sc-start-number{font-weight:600}',
      '.sc-brand-icon{border-radius:12px;color:var(--sc-on-accent);background:var(--sc-accent-fill)}',
      '.sc-badge-accent{color:var(--sc-accent-text);background:color-mix(in srgb,var(--sc-accent-fill) 12%,var(--sc-card))}',

      // Segmented controls (main tabs + sub tabs)
      '.sc-tabs,.sc-ykt-subtabs{display:inline-flex;align-self:flex-start;flex-wrap:wrap;gap:2px;padding:3px;border:0;border-radius:var(--sc-radius-pill);background:var(--sc-fill);max-width:100%}',
      '.sc-tab,.sc-ykt-subtab{margin:0;border:0;border-radius:var(--sc-radius-pill);padding:6px 16px;color:var(--sc-fg-2);transition:background-color var(--sc-fast) var(--sc-ease),color var(--sc-fast) var(--sc-ease),box-shadow var(--sc-fast) var(--sc-ease)}',
      '.sc-tab:hover,.sc-ykt-subtab:hover{background:transparent;color:var(--sc-fg)}',
      '.sc-tab[data-active="1"],.sc-ykt-subtab[data-active="1"]{background:var(--sc-card);color:var(--sc-fg);font-weight:600;box-shadow:0 1px 3px rgba(0,0,0,.12),0 0 0 .5px rgba(0,0,0,.04)}',

      // Buttons: Apple capsule family
      '.sc-btn{border-radius:var(--sc-radius-pill);border-color:var(--sc-border);background:transparent;font-weight:500;transition:background-color var(--sc-fast) var(--sc-ease),border-color var(--sc-fast) var(--sc-ease),box-shadow var(--sc-fast) var(--sc-ease),transform var(--sc-fast) var(--sc-ease)}',
      '.sc-btn:hover{background:var(--dsw-alias-interactive-bg-hover);border-color:var(--sc-meta)}',
      '.sc-btn:active:not(:disabled),.sc-ykt-chip:active,.sc-grade:active:not(:disabled){transform:scale(.98)}',
      '.sc-btn-primary{background:var(--sc-accent-fill);border-color:transparent;color:var(--sc-on-accent)}',
      '.sc-btn-primary:hover{background:var(--sc-accent-hover);border-color:transparent}',
      '.sc-btn-primary:active:not(:disabled){background:var(--sc-accent-active)}',
      '.sc-ykt-viewer .sc-ykt-viewer-close{border-color:rgba(255,255,255,.24);color:inherit}',
      '.sc-ykt-viewer .sc-ykt-viewer-close:hover{background:rgba(255,255,255,.12)}',
      '.sc-iconbtn,.sc-linkbtn{border-radius:var(--sc-radius-pill)}',
      '.sc-linkbtn{color:var(--sc-accent-text)}',
      '.sc-btn:focus-visible,.sc-tab:focus-visible,.sc-ykt-subtab:focus-visible,.sc-ykt-chip:focus-visible,.sc-ykt-course:focus-visible,.sc-ykt-row:focus-visible,.sc-grade:focus-visible,.sc-iconbtn:focus-visible,.sc-linkbtn:focus-visible,.sc-goalbtn:focus-visible,.sc-dock:focus-visible,.sc-ykt-slide-open:focus-visible,.sc-ykt-tool:focus-visible{outline:none;box-shadow:var(--sc-focus-ring)}',

      // Fields
      '.sc-input{border-radius:var(--sc-radius-field);border-color:var(--sc-border);transition:border-color var(--sc-fast) var(--sc-ease),box-shadow var(--sc-fast) var(--sc-ease)}',
      '.sc-input:hover{border-color:var(--sc-meta)}',
      '.sc-input:focus,.sc-input:focus-visible{border-color:var(--sc-accent-fill);box-shadow:var(--sc-focus-ring)}',

      // Cards and panels
      '.sc-card,.sc-stat,.sc-start,.sc-ykt-course,.sc-ykt-login-card,.sc-empty-card,.sc-flashcard,.sc-ykt-summary{border-radius:var(--sc-radius-card);border-color:var(--sc-border-soft)}',
      '.sc-flashcard{box-shadow:var(--sc-elev-raised)}',
      '.sc-ykt-course{transition:box-shadow var(--sc-base) var(--sc-ease),border-color var(--sc-base) var(--sc-ease)}',
      '.sc-ykt-course:hover{background:var(--sc-card);border-color:var(--sc-border-soft);box-shadow:var(--sc-elev-raised)}',
      '.sc-ykt-course-go{color:var(--sc-accent-text)}',
      '.sc-ykt-row{border-radius:14px;border-color:var(--sc-border-soft)}',
      '.sc-ykt-slide{border-radius:12px;border-color:var(--sc-border-soft)}',
      '.sc-ykt-pickbar{border-radius:14px;border-color:var(--sc-border-soft)}',
      '.sc-ykt-slide-pick:focus-within{box-shadow:var(--sc-focus-ring)}',
      '.sc-grade{border-radius:14px}',
      '.sc-alert{border-radius:12px}',
      '.sc-chip,.sc-tag{border-color:transparent}',
      '.sc-ykt-chip{transition:background-color var(--sc-fast) var(--sc-ease),color var(--sc-fast) var(--sc-ease)}',
      '.sc-ykt-chip[data-active="1"]{background:var(--sc-fg);border-color:transparent;color:var(--sc-canvas)}',
      '.sc-progress-fill,.sc-mastery-fill[data-tone="learning"]{background:var(--sc-accent-fill)}',

      // Knowledge board: neutral pegboard (no warm tint), soft Apple card lift
      '.sc-kb-pegboard{background-color:var(--sc-fill);border-color:var(--sc-border-soft);border-radius:var(--sc-radius-card);box-shadow:none}',
      '.sc-kb-tree{border-radius:14px;border-color:var(--sc-border-soft);box-shadow:var(--sc-elev-raised)}',
      '.sc-kb-menu{border-radius:14px;border-color:var(--sc-border-soft);background:color-mix(in srgb,var(--sc-card) 88%,transparent);-webkit-backdrop-filter:saturate(180%) blur(20px);backdrop-filter:saturate(180%) blur(20px);box-shadow:0 12px 32px rgba(0,0,0,.16)}',
      '.sc-kb-menu-item{border-radius:8px}',

      // Slide viewer + page chat
      '.sc-ykt-viewer{background:rgba(0,0,0,.94)}',
      '.sc-ykt-viewer-head{background:rgba(22,22,23,.8);-webkit-backdrop-filter:saturate(180%) blur(20px);backdrop-filter:saturate(180%) blur(20px)}',
      '.sc-ykt-viewer-stage{background:#000}',
      '.sc-ykt-tool{border-radius:var(--sc-radius-pill);padding:0 12px}',
      '.sc-ykt-chat{background:var(--sc-card)}',
      '.sc-ykt-chat-anno{border-radius:10px;color:var(--sc-accent-text);background:color-mix(in srgb,var(--sc-accent-fill) 10%,var(--sc-card))}',
      '.sc-ykt-msg-bubble{border-radius:18px;padding:8px 12px}',
      '.sc-ykt-msg[data-role="user"] .sc-ykt-msg-bubble{background:var(--sc-accent-fill);color:var(--sc-on-accent)}',

      // Composer dock: frosted capsule
      '.sc-dock{background:color-mix(in srgb,var(--sc-card) 78%,transparent);border-color:var(--sc-border-soft);-webkit-backdrop-filter:saturate(180%) blur(20px);backdrop-filter:saturate(180%) blur(20px);transition:background-color var(--sc-fast) var(--sc-ease)}',
      '.sc-dock-icon{color:var(--sc-accent-text)}',
      '.sc-dock-badge[data-due="1"]{color:var(--sc-on-accent);background:var(--sc-accent-fill)}',

      '@media (prefers-reduced-motion: reduce){.sc-btn,.sc-tab,.sc-ykt-subtab,.sc-ykt-chip,.sc-ykt-course,.sc-input,.sc-dock{transition:none!important}.sc-btn:active,.sc-ykt-chip:active,.sc-grade:active{transform:none!important}}',
    ].join('\n')

    /**
     * Mirror the host's light/dark state onto html[data-sc-theme] by sampling
     * the host's own background alias (outside our rebinding scope).
     */
    function syncHostTheme() {
      if (typeof document === 'undefined' || !document.body) return function () {}
      const probe = document.createElement('div')
      probe.setAttribute('aria-hidden', 'true')
      probe.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none;background:var(--dsw-alias-bg-layer-1,Canvas)'
      document.body.appendChild(probe)
      const media = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null
      const update = function () {
        let dark = media ? media.matches : false
        try {
          const match = /rgba?\(([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)(?:[ ,/]+([\d.]+))?/.exec(getComputedStyle(probe).backgroundColor || '')
          if (match && (match[4] === undefined || Number(match[4]) > 0)) {
            const luminance = (0.2126 * Number(match[1]) + 0.7152 * Number(match[2]) + 0.0722 * Number(match[3])) / 255
            dark = luminance < 0.5
          }
        } catch (error) {
          /* keep the media-query guess */
        }
        const next = dark ? 'dark' : 'light'
        if (document.documentElement.getAttribute('data-sc-theme') !== next) document.documentElement.setAttribute('data-sc-theme', next)
      }
      update()
      const observer = typeof MutationObserver === 'function' ? new MutationObserver(update) : null
      if (observer) {
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style', 'data-theme', 'data-color-mode'] })
        observer.observe(document.body, { attributes: true, attributeFilter: ['class', 'style', 'data-theme', 'data-color-mode'] })
      }
      if (media && typeof media.addEventListener === 'function') media.addEventListener('change', update)
      return function () {
        if (observer) observer.disconnect()
        if (media && typeof media.removeEventListener === 'function') media.removeEventListener('change', update)
        if (probe.parentNode) probe.parentNode.removeChild(probe)
        document.documentElement.removeAttribute('data-sc-theme')
      }
    }

    // ------------------------------------------------------------------
    // Plugin registration
    // ------------------------------------------------------------------
    function apply(ctx) {
      const locale = ctx.get('locale')
      if (locale && typeof locale.register === 'function') {
        ctx.effect(function () {
          return locale.register(NS, { zh: ZH, en: EN })
        })
      }

      ctx.effect(function () {
        const tag = document.createElement('style')
        tag.setAttribute('data-plugin', 'dsh-study-coach')
        tag.textContent = CSS + '\n' + APPLE_CSS
        document.head.appendChild(tag)
        const stopThemeSync = syncHostTheme()
        return function () {
          stopThemeSync()
          if (tag.parentNode) tag.parentNode.removeChild(tag)
        }
      })

      const slots = ctx.get('slots')
      if (!slots) return

      const tInjection = function () {
        return {
          t: locale && typeof locale.bind === 'function' ? locale.bind(NS) : undefined,
        }
      }

      const bindT = function (provided) {
        return function (key, params) {
          if (typeof provided === 'function') {
            try {
              const value = provided(key, params)
              if (value !== undefined && value !== null && value !== key) return value
            } catch (error) {
              /* fall through to the local dictionaries */
            }
          }
          let id = 'zh'
          try {
            const snapshot = locale && typeof locale.getSnapshot === 'function' ? locale.getSnapshot() : null
            if (snapshot && typeof snapshot.active === 'string' && snapshot.active.toLowerCase().indexOf('en') === 0) id = 'en'
          } catch (error) {
            /* keep zh */
          }
          return formatText(id === 'en' ? EN : ZH, key, params)
        }
      }

      const navLabel = function () {
        let id = 'zh'
        try {
          const snapshot = locale && typeof locale.getSnapshot === 'function' ? locale.getSnapshot() : null
          if (snapshot && typeof snapshot.active === 'string' && snapshot.active.toLowerCase().indexOf('en') === 0) id = 'en'
        } catch (error) {
          /* keep zh */
        }
        return formatText(id === 'en' ? EN : ZH, 'nav.title')
      }

      slots.inject('main', function () {
        return slots.register({ name: 'main', key: 'study-coach', locale: NS, inject: tInjection }, function (ownerProps) {
          return h(StudyPage, Object.assign({}, ownerProps, { ctx: ctx, t: bindT(ownerProps && ownerProps.t) }))
        })
      })

      slots.inject('sidebar.panellist', function () {
        return slots.register(
          { name: 'sidebar.panellist', id: 'study-coach', order: 32, locale: NS, label: navLabel },
          function (owner) {
            return h(BookIcon, { size: (owner && owner.size) || 16 })
          }
        )
      })

      slots.inject('conversation.composer.dock', function () {
        return slots.register({ name: 'conversation.composer.dock', id: 'study-coach', order: 6, locale: NS, inject: tInjection }, function (ownerProps) {
          return h(StudyDock, Object.assign({}, ownerProps, { ctx: ctx, t: bindT(ownerProps && ownerProps.t) }))
        })
      })
    }

    return {
      inject: ['slots', 'locale'],
      apply: apply,
      // Test seam for offline render smoke tests; not used by the Host or slot system.
      __test: {
        StudyPage: StudyPage,
        ReviewTab: ReviewTab,
        LibraryTab: LibraryTab,
        StatsTab: StatsTab,
        YktTab: YktTab,
        YktSlideViewer: YktSlideViewer,
        YktSummaryView: YktSummaryView,
        YktKnowledgeBoard: YktKnowledgeBoard,
        YktSummaryProgress: YktSummaryProgress,
        YktModelPicker: YktModelPicker,
        summaryMarkdown: summaryMarkdown,
        texToMathML: texToMathML,
        renderRich: renderRich,
        drawAnnotationStroke: drawAnnotationStroke,
        buildOverlayDataUrl: buildOverlayDataUrl,
        StudyDock: StudyDock,
        normalizeState: normalizeState,
        renderQrSvg: function (text) {
          const code = qrcode(0, 'M')
          code.addData(text)
          code.make()
          return code.createSvgTag({ cellSize: 2, margin: 4, scalable: true })
        },
        gradeCard: gradeCard,
        computeStats: computeStats,
        dictionaries: { zh: ZH, en: EN },
      },
    }
  },
})
