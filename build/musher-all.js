/***********************************************
* Musher Javascript and Node.js Library v0.2.1
* https://github.com/taoyuan/musher
* 
* Copyright (c) 2015 Tao Yuan.
* Licensed MIT 
* 
* Date: 2015-07-23 18:13
***********************************************/
// Only expose a single object name in the global namespace.
// Everything must go through this module. Global Paho.MQTT module
// only has a single public function, client, which returns
// a Paho.MQTT client object given connection details.

/**
 * Send and receive messages using web browsers.
 * <p>
 * This programming interface lets a JavaScript client application use the MQTT V3.1 or
 * V3.1.1 protocol to connect to an MQTT-supporting messaging server.
 *
 * The function supported includes:
 * <ol>
 * <li>Connecting to and disconnecting from a server. The server is identified by its host name and port number.
 * <li>Specifying options that relate to the communications link with the server,
 * for example the frequency of keep-alive heartbeats, and whether SSL/TLS is required.
 * <li>Subscribing to and receiving messages from MQTT Topics.
 * <li>Publishing messages to MQTT Topics.
 * </ol>
 * <p>
 * The API consists of two main objects:
 * <dl>
 * <dt><b>{@link Paho.MQTT.Client}</b></dt>
 * <dd>This contains methods that provide the functionality of the API,
 * including provision of callbacks that notify the application when a message
 * arrives from or is delivered to the messaging server,
 * or when the status of its connection to the messaging server changes.</dd>
 * <dt><b>{@link Paho.MQTT.Message}</b></dt>
 * <dd>This encapsulates the payload of the message along with various attributes
 * associated with its delivery, in particular the destination to which it has
 * been (or is about to be) sent.</dd>
 * </dl>
 * <p>
 * The programming interface validates parameters passed to it, and will throw
 * an Error containing an error message intended for developer use, if it detects
 * an error with any parameter.
 * <p>
 * Example:
 *
 * <code><pre>
 client = new Paho.MQTT.Client(location.hostname, Number(location.port), "clientId");
 client.onConnectionLost = onConnectionLost;
 client.onMessageArrived = onMessageArrived;
 client.connect({onSuccess:onConnect});

 function onConnect() {
  // Once a connection has been made, make a subscription and send a message.
  console.log("onConnect");
  client.subscribe("/World");
  message = new Paho.MQTT.Message("Hello");
  message.destinationName = "/World";
  client.send(message); 
};
 function onConnectionLost(responseObject) {
  if (responseObject.errorCode !== 0)
	console.log("onConnectionLost:"+responseObject.errorMessage);
};
 function onMessageArrived(message) {
  console.log("onMessageArrived:"+message.payloadString);
  client.disconnect(); 
};
 * </pre></code>
 * @namespace Paho.MQTT
 */

if (typeof Paho === "undefined") {
  Paho = {};
}

Paho.MQTT = (function (global) {

  // Private variables below, these are only visible inside the function closure
  // which is used to define the module.

  var version = "@VERSION@";
  var buildLevel = "@BUILDLEVEL@";

  /**
   * Unique message type identifiers, with associated
   * associated integer values.
   * @private
   */
  var MESSAGE_TYPE = {
    CONNECT: 1,
    CONNACK: 2,
    PUBLISH: 3,
    PUBACK: 4,
    PUBREC: 5,
    PUBREL: 6,
    PUBCOMP: 7,
    SUBSCRIBE: 8,
    SUBACK: 9,
    UNSUBSCRIBE: 10,
    UNSUBACK: 11,
    PINGREQ: 12,
    PINGRESP: 13,
    DISCONNECT: 14
  };

  // Collection of utility methods used to simplify module code
  // and promote the DRY pattern.

  /**
   * Validate an object's parameter names to ensure they
   * match a list of expected variables name for this option
   * type. Used to ensure option object passed into the API don't
   * contain erroneous parameters.
   * @param {Object} obj - User options object
   * @param {Object} keys - valid keys and types that may exist in obj.
   * @throws {Error} Invalid option parameter found.
   * @private
   */
  var validate = function(obj, keys) {
    for (var key in obj) {
      if (obj.hasOwnProperty(key)) {
        if (keys.hasOwnProperty(key)) {
          if (typeof obj[key] !== keys[key])
            throw new Error(format(ERROR.INVALID_TYPE, [typeof obj[key], key]));
        } else {
          var errorStr = "Unknown property, " + key + ". Valid properties are:";
          for (var key in keys)
            if (keys.hasOwnProperty(key))
              errorStr = errorStr+" "+key;
          throw new Error(errorStr);
        }
      }
    }
  };

  /**
   * Return a new function which runs the user function bound
   * to a fixed scope.
   * @param {function} User function
   * @param {object} Function scope
   * @return {function} User function bound to another scope
   * @private
   */
  var scope = function (f, scope) {
    return function () {
      return f.apply(scope, arguments);
    };
  };

  /**
   * Unique message type identifiers, with associated
   * associated integer values.
   * @private
   */
  var ERROR = {
    OK: {code:0, text:"AMQJSC0000I OK."},
    CONNECT_TIMEOUT: {code:1, text:"AMQJSC0001E Connect timed out."},
    SUBSCRIBE_TIMEOUT: {code:2, text:"AMQJS0002E Subscribe timed out."},
    UNSUBSCRIBE_TIMEOUT: {code:3, text:"AMQJS0003E Unsubscribe timed out."},
    PING_TIMEOUT: {code:4, text:"AMQJS0004E Ping timed out."},
    INTERNAL_ERROR: {code:5, text:"AMQJS0005E Internal error."},
    CONNACK_RETURNCODE: {code:6, text:"AMQJS0006E Bad Connack return code:{0} {1}."},
    SOCKET_ERROR: {code:7, text:"AMQJS0007E Socket error:{0}."},
    SOCKET_CLOSE: {code:8, text:"AMQJS0008I Socket closed."},
    MALFORMED_UTF: {code:9, text:"AMQJS0009E Malformed UTF data:{0} {1} {2}."},
    UNSUPPORTED: {code:10, text:"AMQJS0010E {0} is not supported by this browser."},
    INVALID_STATE: {code:11, text:"AMQJS0011E Invalid state {0}."},
    INVALID_TYPE: {code:12, text:"AMQJS0012E Invalid type {0} for {1}."},
    INVALID_ARGUMENT: {code:13, text:"AMQJS0013E Invalid argument {0} for {1}."},
    UNSUPPORTED_OPERATION: {code:14, text:"AMQJS0014E Unsupported operation."},
    INVALID_STORED_DATA: {code:15, text:"AMQJS0015E Invalid data in local storage key={0} value={1}."},
    INVALID_MQTT_MESSAGE_TYPE: {code:16, text:"AMQJS0016E Invalid MQTT message type {0}."},
    MALFORMED_UNICODE: {code:17, text:"AMQJS0017E Malformed Unicode string:{0} {1}."},
  };

  /** CONNACK RC Meaning. */
  var CONNACK_RC = {
    0:"Connection Accepted",
    1:"Connection Refused: unacceptable protocol version",
    2:"Connection Refused: identifier rejected",
    3:"Connection Refused: server unavailable",
    4:"Connection Refused: bad user name or password",
    5:"Connection Refused: not authorized"
  };

  /**
   * Format an error message text.
   * @private
   * @param {error} ERROR.KEY value above.
   * @param {substitutions} [array] substituted into the text.
   * @return the text with the substitutions made.
   */
  var format = function(error, substitutions) {
    var text = error.text;
    if (substitutions) {
      for (var i=0; i<substitutions.length; i++) {
        field = "{"+i+"}";
        start = text.indexOf(field);
        if(start > 0) {
          var part1 = text.substring(0,start);
          var part2 = text.substring(start+field.length);
          text = part1+substitutions[i]+part2;
        }
      }
    }
    return text;
  };

  //MQTT protocol and version          6    M    Q    I    s    d    p    3
  var MqttProtoIdentifierv3 = [0x00,0x06,0x4d,0x51,0x49,0x73,0x64,0x70,0x03];
  //MQTT proto/version for 311         4    M    Q    T    T    4
  var MqttProtoIdentifierv4 = [0x00,0x04,0x4d,0x51,0x54,0x54,0x04];

  /**
   * Construct an MQTT wire protocol message.
   * @param type MQTT packet type.
   * @param options optional wire message attributes.
   *
   * Optional properties
   *
   * messageIdentifier: message ID in the range [0..65535]
   * payloadMessage:	Application Message - PUBLISH only
   * connectStrings:	array of 0 or more Strings to be put into the CONNECT payload
   * topics:			array of strings (SUBSCRIBE, UNSUBSCRIBE)
   * requestQoS:		array of QoS values [0..2]
   *
   * "Flag" properties
   * cleanSession:	true if present / false if absent (CONNECT)
   * willMessage:  	true if present / false if absent (CONNECT)
   * isRetained:		true if present / false if absent (CONNECT)
   * userName:		true if present / false if absent (CONNECT)
   * password:		true if present / false if absent (CONNECT)
   * keepAliveInterval:	integer [0..65535]  (CONNECT)
   *
   * @private
   * @ignore
   */
  var WireMessage = function (type, options) {
    this.type = type;
    for (var name in options) {
      if (options.hasOwnProperty(name)) {
        this[name] = options[name];
      }
    }
  };

  WireMessage.prototype.encode = function() {
    // Compute the first byte of the fixed header
    var first = ((this.type & 0x0f) << 4);

    /*
     * Now calculate the length of the variable header + payload by adding up the lengths
     * of all the component parts
     */

    remLength = 0;
    topicStrLength = new Array();

    // if the message contains a messageIdentifier then we need two bytes for that
    if (this.messageIdentifier != undefined)
      remLength += 2;

    switch(this.type) {
      // If this a Connect then we need to include 12 bytes for its header
      case MESSAGE_TYPE.CONNECT:
        switch(this.mqttVersion) {
          case 3:
            remLength += MqttProtoIdentifierv3.length + 3;
            break;
          case 4:
            remLength += MqttProtoIdentifierv4.length + 3;
            break;
        }

        remLength += UTF8Length(this.clientId) + 2;
        if (this.willMessage != undefined) {
          remLength += UTF8Length(this.willMessage.destinationName) + 2;
          // Will message is always a string, sent as UTF-8 characters with a preceding length.
          var willMessagePayloadBytes = this.willMessage.payloadBytes;
          if (!(willMessagePayloadBytes instanceof Uint8Array))
            willMessagePayloadBytes = new Uint8Array(payloadBytes);
          remLength += willMessagePayloadBytes.byteLength +2;
        }
        if (this.userName != undefined)
          remLength += UTF8Length(this.userName) + 2;
        if (this.password != undefined)
          remLength += UTF8Length(this.password) + 2;
        break;

      // Subscribe, Unsubscribe can both contain topic strings
      case MESSAGE_TYPE.SUBSCRIBE:
        first |= 0x02; // Qos = 1;
        for ( var i = 0; i < this.topics.length; i++) {
          topicStrLength[i] = UTF8Length(this.topics[i]);
          remLength += topicStrLength[i] + 2;
        }
        remLength += this.requestedQos.length; // 1 byte for each topic's Qos
        // QoS on Subscribe only
        break;

      case MESSAGE_TYPE.UNSUBSCRIBE:
        first |= 0x02; // Qos = 1;
        for ( var i = 0; i < this.topics.length; i++) {
          topicStrLength[i] = UTF8Length(this.topics[i]);
          remLength += topicStrLength[i] + 2;
        }
        break;

      case MESSAGE_TYPE.PUBREL:
        first |= 0x02; // Qos = 1;
        break;

      case MESSAGE_TYPE.PUBLISH:
        if (this.payloadMessage.duplicate) first |= 0x08;
        first  = first |= (this.payloadMessage.qos << 1);
        if (this.payloadMessage.retained) first |= 0x01;
        destinationNameLength = UTF8Length(this.payloadMessage.destinationName);
        remLength += destinationNameLength + 2;
        var payloadBytes = this.payloadMessage.payloadBytes;
        remLength += payloadBytes.byteLength;
        if (payloadBytes instanceof ArrayBuffer)
          payloadBytes = new Uint8Array(payloadBytes);
        else if (!(payloadBytes instanceof Uint8Array))
          payloadBytes = new Uint8Array(payloadBytes.buffer);
        break;

      case MESSAGE_TYPE.DISCONNECT:
        break;

      default:
        ;
    }

    // Now we can allocate a buffer for the message

    var mbi = encodeMBI(remLength);  // Convert the length to MQTT MBI format
    var pos = mbi.length + 1;        // Offset of start of variable header
    var buffer = new ArrayBuffer(remLength + pos);
    var byteStream = new Uint8Array(buffer);    // view it as a sequence of bytes

    //Write the fixed header into the buffer
    byteStream[0] = first;
    byteStream.set(mbi,1);

    // If this is a PUBLISH then the variable header starts with a topic
    if (this.type == MESSAGE_TYPE.PUBLISH)
      pos = writeString(this.payloadMessage.destinationName, destinationNameLength, byteStream, pos);
    // If this is a CONNECT then the variable header contains the protocol name/version, flags and keepalive time

    else if (this.type == MESSAGE_TYPE.CONNECT) {
      switch (this.mqttVersion) {
        case 3:
          byteStream.set(MqttProtoIdentifierv3, pos);
          pos += MqttProtoIdentifierv3.length;
          break;
        case 4:
          byteStream.set(MqttProtoIdentifierv4, pos);
          pos += MqttProtoIdentifierv4.length;
          break;
      }
      var connectFlags = 0;
      if (this.cleanSession)
        connectFlags = 0x02;
      if (this.willMessage != undefined ) {
        connectFlags |= 0x04;
        connectFlags |= (this.willMessage.qos<<3);
        if (this.willMessage.retained) {
          connectFlags |= 0x20;
        }
      }
      if (this.userName != undefined)
        connectFlags |= 0x80;
      if (this.password != undefined)
        connectFlags |= 0x40;
      byteStream[pos++] = connectFlags;
      pos = writeUint16 (this.keepAliveInterval, byteStream, pos);
    }

    // Output the messageIdentifier - if there is one
    if (this.messageIdentifier != undefined)
      pos = writeUint16 (this.messageIdentifier, byteStream, pos);

    switch(this.type) {
      case MESSAGE_TYPE.CONNECT:
        pos = writeString(this.clientId, UTF8Length(this.clientId), byteStream, pos);
        if (this.willMessage != undefined) {
          pos = writeString(this.willMessage.destinationName, UTF8Length(this.willMessage.destinationName), byteStream, pos);
          pos = writeUint16(willMessagePayloadBytes.byteLength, byteStream, pos);
          byteStream.set(willMessagePayloadBytes, pos);
          pos += willMessagePayloadBytes.byteLength;

        }
        if (this.userName != undefined)
          pos = writeString(this.userName, UTF8Length(this.userName), byteStream, pos);
        if (this.password != undefined)
          pos = writeString(this.password, UTF8Length(this.password), byteStream, pos);
        break;

      case MESSAGE_TYPE.PUBLISH:
        // PUBLISH has a text or binary payload, if text do not add a 2 byte length field, just the UTF characters.
        byteStream.set(payloadBytes, pos);

        break;

//    	    case MESSAGE_TYPE.PUBREC:	
//    	    case MESSAGE_TYPE.PUBREL:	
//    	    case MESSAGE_TYPE.PUBCOMP:	
//    	    	break;

      case MESSAGE_TYPE.SUBSCRIBE:
        // SUBSCRIBE has a list of topic strings and request QoS
        for (var i=0; i<this.topics.length; i++) {
          pos = writeString(this.topics[i], topicStrLength[i], byteStream, pos);
          byteStream[pos++] = this.requestedQos[i];
        }
        break;

      case MESSAGE_TYPE.UNSUBSCRIBE:
        // UNSUBSCRIBE has a list of topic strings
        for (var i=0; i<this.topics.length; i++)
          pos = writeString(this.topics[i], topicStrLength[i], byteStream, pos);
        break;

      default:
      // Do nothing.
    }

    return buffer;
  }

  function decodeMessage(input,pos) {
    var startingPos = pos;
    var first = input[pos];
    var type = first >> 4;
    var messageInfo = first &= 0x0f;
    pos += 1;


    // Decode the remaining length (MBI format)

    var digit;
    var remLength = 0;
    var multiplier = 1;
    do {
      if (pos == input.length) {
        return [null,startingPos];
      }
      digit = input[pos++];
      remLength += ((digit & 0x7F) * multiplier);
      multiplier *= 128;
    } while ((digit & 0x80) != 0);

    var endPos = pos+remLength;
    if (endPos > input.length) {
      return [null,startingPos];
    }

    var wireMessage = new WireMessage(type);
    switch(type) {
      case MESSAGE_TYPE.CONNACK:
        var connectAcknowledgeFlags = input[pos++];
        if (connectAcknowledgeFlags & 0x01)
          wireMessage.sessionPresent = true;
        wireMessage.returnCode = input[pos++];
        break;

      case MESSAGE_TYPE.PUBLISH:
        var qos = (messageInfo >> 1) & 0x03;

        var len = readUint16(input, pos);
        pos += 2;
        var topicName = parseUTF8(input, pos, len);
        pos += len;
        // If QoS 1 or 2 there will be a messageIdentifier
        if (qos > 0) {
          wireMessage.messageIdentifier = readUint16(input, pos);
          pos += 2;
        }

        var message = new Paho.MQTT.Message(input.subarray(pos, endPos));
        if ((messageInfo & 0x01) == 0x01)
          message.retained = true;
        if ((messageInfo & 0x08) == 0x08)
          message.duplicate =  true;
        message.qos = qos;
        message.destinationName = topicName;
        wireMessage.payloadMessage = message;
        break;

      case  MESSAGE_TYPE.PUBACK:
      case  MESSAGE_TYPE.PUBREC:
      case  MESSAGE_TYPE.PUBREL:
      case  MESSAGE_TYPE.PUBCOMP:
      case  MESSAGE_TYPE.UNSUBACK:
        wireMessage.messageIdentifier = readUint16(input, pos);
        break;

      case  MESSAGE_TYPE.SUBACK:
        wireMessage.messageIdentifier = readUint16(input, pos);
        pos += 2;
        wireMessage.returnCode = input.subarray(pos, endPos);
        break;

      default:
        ;
    }

    return [wireMessage,endPos];
  }

  function writeUint16(input, buffer, offset) {
    buffer[offset++] = input >> 8;      //MSB
    buffer[offset++] = input % 256;     //LSB
    return offset;
  }

  function writeString(input, utf8Length, buffer, offset) {
    offset = writeUint16(utf8Length, buffer, offset);
    stringToUTF8(input, buffer, offset);
    return offset + utf8Length;
  }

  function readUint16(buffer, offset) {
    return 256*buffer[offset] + buffer[offset+1];
  }

  /**
   * Encodes an MQTT Multi-Byte Integer
   * @private
   */
  function encodeMBI(number) {
    var output = new Array(1);
    var numBytes = 0;

    do {
      var digit = number % 128;
      number = number >> 7;
      if (number > 0) {
        digit |= 0x80;
      }
      output[numBytes++] = digit;
    } while ( (number > 0) && (numBytes<4) );

    return output;
  }

  /**
   * Takes a String and calculates its length in bytes when encoded in UTF8.
   * @private
   */
  function UTF8Length(input) {
    var output = 0;
    for (var i = 0; i<input.length; i++)
    {
      var charCode = input.charCodeAt(i);
      if (charCode > 0x7FF)
      {
        // Surrogate pair means its a 4 byte character
        if (0xD800 <= charCode && charCode <= 0xDBFF)
        {
          i++;
          output++;
        }
        output +=3;
      }
      else if (charCode > 0x7F)
        output +=2;
      else
        output++;
    }
    return output;
  }

  /**
   * Takes a String and writes it into an array as UTF8 encoded bytes.
   * @private
   */
  function stringToUTF8(input, output, start) {
    var pos = start;
    for (var i = 0; i<input.length; i++) {
      var charCode = input.charCodeAt(i);

      // Check for a surrogate pair.
      if (0xD800 <= charCode && charCode <= 0xDBFF) {
        lowCharCode = input.charCodeAt(++i);
        if (isNaN(lowCharCode)) {
          throw new Error(format(ERROR.MALFORMED_UNICODE, [charCode, lowCharCode]));
        }
        charCode = ((charCode - 0xD800)<<10) + (lowCharCode - 0xDC00) + 0x10000;

      }

      if (charCode <= 0x7F) {
        output[pos++] = charCode;
      } else if (charCode <= 0x7FF) {
        output[pos++] = charCode>>6  & 0x1F | 0xC0;
        output[pos++] = charCode     & 0x3F | 0x80;
      } else if (charCode <= 0xFFFF) {
        output[pos++] = charCode>>12 & 0x0F | 0xE0;
        output[pos++] = charCode>>6  & 0x3F | 0x80;
        output[pos++] = charCode     & 0x3F | 0x80;
      } else {
        output[pos++] = charCode>>18 & 0x07 | 0xF0;
        output[pos++] = charCode>>12 & 0x3F | 0x80;
        output[pos++] = charCode>>6  & 0x3F | 0x80;
        output[pos++] = charCode     & 0x3F | 0x80;
      };
    }
    return output;
  }

  function parseUTF8(input, offset, length) {
    var output = "";
    var utf16;
    var pos = offset;

    while (pos < offset+length)
    {
      var byte1 = input[pos++];
      if (byte1 < 128)
        utf16 = byte1;
      else
      {
        var byte2 = input[pos++]-128;
        if (byte2 < 0)
          throw new Error(format(ERROR.MALFORMED_UTF, [byte1.toString(16), byte2.toString(16),""]));
        if (byte1 < 0xE0)             // 2 byte character
          utf16 = 64*(byte1-0xC0) + byte2;
        else
        {
          var byte3 = input[pos++]-128;
          if (byte3 < 0)
            throw new Error(format(ERROR.MALFORMED_UTF, [byte1.toString(16), byte2.toString(16), byte3.toString(16)]));
          if (byte1 < 0xF0)        // 3 byte character
            utf16 = 4096*(byte1-0xE0) + 64*byte2 + byte3;
          else
          {
            var byte4 = input[pos++]-128;
            if (byte4 < 0)
              throw new Error(format(ERROR.MALFORMED_UTF, [byte1.toString(16), byte2.toString(16), byte3.toString(16), byte4.toString(16)]));
            if (byte1 < 0xF8)        // 4 byte character
              utf16 = 262144*(byte1-0xF0) + 4096*byte2 + 64*byte3 + byte4;
            else                     // longer encodings are not supported
              throw new Error(format(ERROR.MALFORMED_UTF, [byte1.toString(16), byte2.toString(16), byte3.toString(16), byte4.toString(16)]));
          }
        }
      }

      if (utf16 > 0xFFFF)   // 4 byte character - express as a surrogate pair
      {
        utf16 -= 0x10000;
        output += String.fromCharCode(0xD800 + (utf16 >> 10)); // lead character
        utf16 = 0xDC00 + (utf16 & 0x3FF);  // trail character
      }
      output += String.fromCharCode(utf16);
    }
    return output;
  }

  /**
   * Repeat keepalive requests, monitor responses.
   * @ignore
   */
  var Pinger = function(client, window, keepAliveInterval) {
    this._client = client;
    this._window = window;
    this._keepAliveInterval = keepAliveInterval*1000;
    this.isReset = false;

    var pingReq = new WireMessage(MESSAGE_TYPE.PINGREQ).encode();

    var doTimeout = function (pinger) {
      return function () {
        return doPing.apply(pinger);
      };
    };

    /** @ignore */
    var doPing = function() {
      if (!this.isReset) {
        this._client._trace("Pinger.doPing", "Timed out");
        this._client._disconnected( ERROR.PING_TIMEOUT.code , format(ERROR.PING_TIMEOUT));
      } else {
        this.isReset = false;
        this._client._trace("Pinger.doPing", "send PINGREQ");
        this._client.socket.send(pingReq);
        this.timeout = this._window.setTimeout(doTimeout(this), this._keepAliveInterval);
      }
    }

    this.reset = function() {
      this.isReset = true;
      this._window.clearTimeout(this.timeout);
      if (this._keepAliveInterval > 0)
        this.timeout = setTimeout(doTimeout(this), this._keepAliveInterval);
    }

    this.cancel = function() {
      this._window.clearTimeout(this.timeout);
    }
  };

  /**
   * Monitor request completion.
   * @ignore
   */
  var Timeout = function(client, window, timeoutSeconds, action, args) {
    this._window = window;
    if (!timeoutSeconds)
      timeoutSeconds = 30;

    var doTimeout = function (action, client, args) {
      return function () {
        return action.apply(client, args);
      };
    };
    this.timeout = setTimeout(doTimeout(action, client, args), timeoutSeconds * 1000);

    this.cancel = function() {
      this._window.clearTimeout(this.timeout);
    }
  };

  /*
   * Internal implementation of the Websockets MQTT V3.1 client.
   *
   * @name Paho.MQTT.ClientImpl @constructor
   * @param {String} host the DNS nameof the webSocket host.
   * @param {Number} port the port number for that host.
   * @param {String} clientId the MQ client identifier.
   */
  var ClientImpl = function (uri, host, port, path, clientId) {
    // Check dependencies are satisfied in this browser.
    if (!("WebSocket" in global && global["WebSocket"] !== null)) {
      throw new Error(format(ERROR.UNSUPPORTED, ["WebSocket"]));
    }
    if (!("localStorage" in global && global["localStorage"] !== null)) {
      throw new Error(format(ERROR.UNSUPPORTED, ["localStorage"]));
    }
    if (!("ArrayBuffer" in global && global["ArrayBuffer"] !== null)) {
      throw new Error(format(ERROR.UNSUPPORTED, ["ArrayBuffer"]));
    }
    this._trace("Paho.MQTT.Client", uri, host, port, path, clientId);

    this.host = host;
    this.port = port;
    this.path = path;
    this.uri = uri;
    this.clientId = clientId;

    // Local storagekeys are qualified with the following string.
    // The conditional inclusion of path in the key is for backward
    // compatibility to when the path was not configurable and assumed to
    // be /mqtt
    this._localKey=host+":"+port+(path!="/mqtt"?":"+path:"")+":"+clientId+":";

    // Create private instance-only message queue
    // Internal queue of messages to be sent, in sending order.
    this._msg_queue = [];

    // Messages we have sent and are expecting a response for, indexed by their respective message ids.
    this._sentMessages = {};

    // Messages we have received and acknowleged and are expecting a confirm message for
    // indexed by their respective message ids.
    this._receivedMessages = {};

    // Internal list of callbacks to be executed when messages
    // have been successfully sent over web socket, e.g. disconnect
    // when it doesn't have to wait for ACK, just message is dispatched.
    this._notify_msg_sent = {};

    // Unique identifier for SEND messages, incrementing
    // counter as messages are sent.
    this._message_identifier = 1;

    // Used to determine the transmission sequence of stored sent messages.
    this._sequence = 0;


    // Load the local state, if any, from the saved version, only restore state relevant to this client.
    for (var key in localStorage)
      if (   key.indexOf("Sent:"+this._localKey) == 0
        || key.indexOf("Received:"+this._localKey) == 0)
        this.restore(key);
  };

  // Messaging Client public instance members.
  ClientImpl.prototype.host;
  ClientImpl.prototype.port;
  ClientImpl.prototype.path;
  ClientImpl.prototype.uri;
  ClientImpl.prototype.clientId;

  // Messaging Client private instance members.
  ClientImpl.prototype.socket;
  /* true once we have received an acknowledgement to a CONNECT packet. */
  ClientImpl.prototype.connected = false;
  /* The largest message identifier allowed, may not be larger than 2**16 but
   * if set smaller reduces the maximum number of outbound messages allowed.
   */
  ClientImpl.prototype.maxMessageIdentifier = 65536;
  ClientImpl.prototype.connectOptions;
  ClientImpl.prototype.hostIndex;
  ClientImpl.prototype.onConnectionLost;
  ClientImpl.prototype.onMessageDelivered;
  ClientImpl.prototype.onMessageArrived;
  ClientImpl.prototype._msg_queue = null;
  ClientImpl.prototype._connectTimeout;
  /* The sendPinger monitors how long we allow before we send data to prove to the server that we are alive. */
  ClientImpl.prototype.sendPinger = null;
  /* The receivePinger monitors how long we allow before we require evidence that the server is alive. */
  ClientImpl.prototype.receivePinger = null;

  ClientImpl.prototype.receiveBuffer = null;

  ClientImpl.prototype._traceBuffer = null;
  ClientImpl.prototype._MAX_TRACE_ENTRIES = 100;

  ClientImpl.prototype.connect = function (connectOptions) {
    var connectOptionsMasked = this._traceMask(connectOptions, "password");
    this._trace("Client.connect", connectOptionsMasked, this.socket, this.connected);

    if (this.connected)
      throw new Error(format(ERROR.INVALID_STATE, ["already connected"]));
    if (this.socket)
      throw new Error(format(ERROR.INVALID_STATE, ["already connected"]));

    this.connectOptions = connectOptions;

    if (connectOptions.uris) {
      this.hostIndex = 0;
      this._doConnect(connectOptions.uris[0]);
    } else {
      this._doConnect(this.uri);
    }

  };

  ClientImpl.prototype.subscribe = function (filter, subscribeOptions) {
    this._trace("Client.subscribe", filter, subscribeOptions);

    if (!this.connected)
      throw new Error(format(ERROR.INVALID_STATE, ["not connected"]));

    var wireMessage = new WireMessage(MESSAGE_TYPE.SUBSCRIBE);
    wireMessage.topics=[filter];
    if (subscribeOptions.qos != undefined)
      wireMessage.requestedQos = [subscribeOptions.qos];
    else
      wireMessage.requestedQos = [0];

    if (subscribeOptions.onSuccess) {
      wireMessage.onSuccess = function(grantedQos) {subscribeOptions.onSuccess({invocationContext:subscribeOptions.invocationContext,grantedQos:grantedQos});};
    }

    if (subscribeOptions.onFailure) {
      wireMessage.onFailure = function(errorCode) {subscribeOptions.onFailure({invocationContext:subscribeOptions.invocationContext,errorCode:errorCode});};
    }

    if (subscribeOptions.timeout) {
      wireMessage.timeOut = new Timeout(this, window, subscribeOptions.timeout, subscribeOptions.onFailure
        , [{invocationContext:subscribeOptions.invocationContext,
          errorCode:ERROR.SUBSCRIBE_TIMEOUT.code,
          errorMessage:format(ERROR.SUBSCRIBE_TIMEOUT)}]);
    }

    // All subscriptions return a SUBACK.
    this._requires_ack(wireMessage);
    this._schedule_message(wireMessage);
  };

  /** @ignore */
  ClientImpl.prototype.unsubscribe = function(filter, unsubscribeOptions) {
    this._trace("Client.unsubscribe", filter, unsubscribeOptions);

    if (!this.connected)
      throw new Error(format(ERROR.INVALID_STATE, ["not connected"]));

    var wireMessage = new WireMessage(MESSAGE_TYPE.UNSUBSCRIBE);
    wireMessage.topics = [filter];

    if (unsubscribeOptions.onSuccess) {
      wireMessage.callback = function() {unsubscribeOptions.onSuccess({invocationContext:unsubscribeOptions.invocationContext});};
    }
    if (unsubscribeOptions.timeout) {
      wireMessage.timeOut = new Timeout(this, window, unsubscribeOptions.timeout, unsubscribeOptions.onFailure
        , [{invocationContext:unsubscribeOptions.invocationContext,
          errorCode:ERROR.UNSUBSCRIBE_TIMEOUT.code,
          errorMessage:format(ERROR.UNSUBSCRIBE_TIMEOUT)}]);
    }

    // All unsubscribes return a SUBACK.
    this._requires_ack(wireMessage);
    this._schedule_message(wireMessage);
  };

  ClientImpl.prototype.send = function (message) {
    this._trace("Client.send", message);

    if (!this.connected)
      throw new Error(format(ERROR.INVALID_STATE, ["not connected"]));

    wireMessage = new WireMessage(MESSAGE_TYPE.PUBLISH);
    wireMessage.payloadMessage = message;

    if (message.qos > 0)
      this._requires_ack(wireMessage);
    else if (this.onMessageDelivered)
      this._notify_msg_sent[wireMessage] = this.onMessageDelivered(wireMessage.payloadMessage);
    this._schedule_message(wireMessage);
  };

  ClientImpl.prototype.disconnect = function () {
    this._trace("Client.disconnect");

    if (!this.socket)
      throw new Error(format(ERROR.INVALID_STATE, ["not connecting or connected"]));

    wireMessage = new WireMessage(MESSAGE_TYPE.DISCONNECT);

    // Run the disconnected call back as soon as the message has been sent,
    // in case of a failure later on in the disconnect processing.
    // as a consequence, the _disconected call back may be run several times.
    this._notify_msg_sent[wireMessage] = scope(this._disconnected, this);

    this._schedule_message(wireMessage);
  };

  ClientImpl.prototype.getTraceLog = function () {
    if ( this._traceBuffer !== null ) {
      this._trace("Client.getTraceLog", new Date());
      this._trace("Client.getTraceLog in flight messages", this._sentMessages.length);
      for (var key in this._sentMessages)
        this._trace("_sentMessages ",key, this._sentMessages[key]);
      for (var key in this._receivedMessages)
        this._trace("_receivedMessages ",key, this._receivedMessages[key]);

      return this._traceBuffer;
    }
  };

  ClientImpl.prototype.startTrace = function () {
    if ( this._traceBuffer === null ) {
      this._traceBuffer = [];
    }
    this._trace("Client.startTrace", new Date(), version);
  };

  ClientImpl.prototype.stopTrace = function () {
    delete this._traceBuffer;
  };

  ClientImpl.prototype._doConnect = function (wsurl) {
    // When the socket is open, this client will send the CONNECT WireMessage using the saved parameters.
    if (this.connectOptions.useSSL) {
      var uriParts = wsurl.split(":");
      uriParts[0] = "wss";
      wsurl = uriParts.join(":");
    }
    this.connected = false;
    this.socket = new WebSocket(wsurl, ["mqtt","mqttv3.1"]);
    this.socket.binaryType = 'arraybuffer';

    this.socket.onopen = scope(this._on_socket_open, this);
    this.socket.onmessage = scope(this._on_socket_message, this);
    this.socket.onerror = scope(this._on_socket_error, this);
    this.socket.onclose = scope(this._on_socket_close, this);

    this.sendPinger = new Pinger(this, window, this.connectOptions.keepAliveInterval);
    this.receivePinger = new Pinger(this, window, this.connectOptions.keepAliveInterval);

    this._connectTimeout = new Timeout(this, window, this.connectOptions.timeout, this._disconnected,  [ERROR.CONNECT_TIMEOUT.code, format(ERROR.CONNECT_TIMEOUT)]);
  };


  // Schedule a new message to be sent over the WebSockets
  // connection. CONNECT messages cause WebSocket connection
  // to be started. All other messages are queued internally
  // until this has happened. When WS connection starts, process
  // all outstanding messages.
  ClientImpl.prototype._schedule_message = function (message) {
    this._msg_queue.push(message);
    // Process outstanding messages in the queue if we have an  open socket, and have received CONNACK.
    if (this.connected) {
      this._process_queue();
    }
  };

  ClientImpl.prototype.store = function(prefix, wireMessage) {
    storedMessage = {type:wireMessage.type, messageIdentifier:wireMessage.messageIdentifier, version:1};

    switch(wireMessage.type) {
      case MESSAGE_TYPE.PUBLISH:
        if(wireMessage.pubRecReceived)
          storedMessage.pubRecReceived = true;

        // Convert the payload to a hex string.
        storedMessage.payloadMessage = {};
        var hex = "";
        var messageBytes = wireMessage.payloadMessage.payloadBytes;
        for (var i=0; i<messageBytes.length; i++) {
          if (messageBytes[i] <= 0xF)
            hex = hex+"0"+messageBytes[i].toString(16);
          else
            hex = hex+messageBytes[i].toString(16);
        }
        storedMessage.payloadMessage.payloadHex = hex;

        storedMessage.payloadMessage.qos = wireMessage.payloadMessage.qos;
        storedMessage.payloadMessage.destinationName = wireMessage.payloadMessage.destinationName;
        if (wireMessage.payloadMessage.duplicate)
          storedMessage.payloadMessage.duplicate = true;
        if (wireMessage.payloadMessage.retained)
          storedMessage.payloadMessage.retained = true;

        // Add a sequence number to sent messages.
        if ( prefix.indexOf("Sent:") == 0 ) {
          if ( wireMessage.sequence === undefined )
            wireMessage.sequence = ++this._sequence;
          storedMessage.sequence = wireMessage.sequence;
        }
        break;

      default:
        throw Error(format(ERROR.INVALID_STORED_DATA, [key, storedMessage]));
    }
    localStorage.setItem(prefix+this._localKey+wireMessage.messageIdentifier, JSON.stringify(storedMessage));
  };

  ClientImpl.prototype.restore = function(key) {
    var value = localStorage.getItem(key);
    var storedMessage = JSON.parse(value);

    var wireMessage = new WireMessage(storedMessage.type, storedMessage);

    switch(storedMessage.type) {
      case MESSAGE_TYPE.PUBLISH:
        // Replace the payload message with a Message object.
        var hex = storedMessage.payloadMessage.payloadHex;
        var buffer = new ArrayBuffer((hex.length)/2);
        var byteStream = new Uint8Array(buffer);
        var i = 0;
        while (hex.length >= 2) {
          var x = parseInt(hex.substring(0, 2), 16);
          hex = hex.substring(2, hex.length);
          byteStream[i++] = x;
        }
        var payloadMessage = new Paho.MQTT.Message(byteStream);

        payloadMessage.qos = storedMessage.payloadMessage.qos;
        payloadMessage.destinationName = storedMessage.payloadMessage.destinationName;
        if (storedMessage.payloadMessage.duplicate)
          payloadMessage.duplicate = true;
        if (storedMessage.payloadMessage.retained)
          payloadMessage.retained = true;
        wireMessage.payloadMessage = payloadMessage;

        break;

      default:
        throw Error(format(ERROR.INVALID_STORED_DATA, [key, value]));
    }

    if (key.indexOf("Sent:"+this._localKey) == 0) {
      wireMessage.payloadMessage.duplicate = true;
      this._sentMessages[wireMessage.messageIdentifier] = wireMessage;
    } else if (key.indexOf("Received:"+this._localKey) == 0) {
      this._receivedMessages[wireMessage.messageIdentifier] = wireMessage;
    }
  };

  ClientImpl.prototype._process_queue = function () {
    var message = null;
    // Process messages in order they were added
    var fifo = this._msg_queue.reverse();

    // Send all queued messages down socket connection
    while ((message = fifo.pop())) {
      this._socket_send(message);
      // Notify listeners that message was successfully sent
      if (this._notify_msg_sent[message]) {
        this._notify_msg_sent[message]();
        delete this._notify_msg_sent[message];
      }
    }
  };

  /**
   * Expect an ACK response for this message. Add message to the set of in progress
   * messages and set an unused identifier in this message.
   * @ignore
   */
  ClientImpl.prototype._requires_ack = function (wireMessage) {
    var messageCount = Object.keys(this._sentMessages).length;
    if (messageCount > this.maxMessageIdentifier)
      throw Error ("Too many messages:"+messageCount);

    while(this._sentMessages[this._message_identifier] !== undefined) {
      this._message_identifier++;
    }
    wireMessage.messageIdentifier = this._message_identifier;
    this._sentMessages[wireMessage.messageIdentifier] = wireMessage;
    if (wireMessage.type === MESSAGE_TYPE.PUBLISH) {
      this.store("Sent:", wireMessage);
    }
    if (this._message_identifier === this.maxMessageIdentifier) {
      this._message_identifier = 1;
    }
  };

  /**
   * Called when the underlying websocket has been opened.
   * @ignore
   */
  ClientImpl.prototype._on_socket_open = function () {
    // Create the CONNECT message object.
    var wireMessage = new WireMessage(MESSAGE_TYPE.CONNECT, this.connectOptions);
    wireMessage.clientId = this.clientId;
    this._socket_send(wireMessage);
  };

  /**
   * Called when the underlying websocket has received a complete packet.
   * @ignore
   */
  ClientImpl.prototype._on_socket_message = function (event) {
    this._trace("Client._on_socket_message", event.data);
    // Reset the receive ping timer, we now have evidence the server is alive.
    this.receivePinger.reset();
    var messages = this._deframeMessages(event.data);
    for (var i = 0; i < messages.length; i+=1) {
      this._handleMessage(messages[i]);
    }
  }

  ClientImpl.prototype._deframeMessages = function(data) {
    var byteArray = new Uint8Array(data);
    if (this.receiveBuffer) {
      var newData = new Uint8Array(this.receiveBuffer.length+byteArray.length);
      newData.set(this.receiveBuffer);
      newData.set(byteArray,this.receiveBuffer.length);
      byteArray = newData;
      delete this.receiveBuffer;
    }
    try {
      var offset = 0;
      var messages = [];
      while(offset < byteArray.length) {
        var result = decodeMessage(byteArray,offset);
        var wireMessage = result[0];
        offset = result[1];
        if (wireMessage !== null) {
          messages.push(wireMessage);
        } else {
          break;
        }
      }
      if (offset < byteArray.length) {
        this.receiveBuffer = byteArray.subarray(offset);
      }
    } catch (error) {
      this._disconnected(ERROR.INTERNAL_ERROR.code , format(ERROR.INTERNAL_ERROR, [error.message]));
      return;
    }
    return messages;
  }

  ClientImpl.prototype._handleMessage = function(wireMessage) {

    this._trace("Client._handleMessage", wireMessage);

    try {
      switch(wireMessage.type) {
        case MESSAGE_TYPE.CONNACK:
          this._connectTimeout.cancel();

          // If we have started using clean session then clear up the local state.
          if (this.connectOptions.cleanSession) {
            for (var key in this._sentMessages) {
              var sentMessage = this._sentMessages[key];
              localStorage.removeItem("Sent:"+this._localKey+sentMessage.messageIdentifier);
            }
            this._sentMessages = {};

            for (var key in this._receivedMessages) {
              var receivedMessage = this._receivedMessages[key];
              localStorage.removeItem("Received:"+this._localKey+receivedMessage.messageIdentifier);
            }
            this._receivedMessages = {};
          }
          // Client connected and ready for business.
          if (wireMessage.returnCode === 0) {
            this.connected = true;
            // Jump to the end of the list of uris and stop looking for a good host.
            if (this.connectOptions.uris)
              this.hostIndex = this.connectOptions.uris.length;
          } else {
            this._disconnected(ERROR.CONNACK_RETURNCODE.code , format(ERROR.CONNACK_RETURNCODE, [wireMessage.returnCode, CONNACK_RC[wireMessage.returnCode]]));
            break;
          }

          // Resend messages.
          var sequencedMessages = new Array();
          for (var msgId in this._sentMessages) {
            if (this._sentMessages.hasOwnProperty(msgId))
              sequencedMessages.push(this._sentMessages[msgId]);
          }

          // Sort sentMessages into the original sent order.
          var sequencedMessages = sequencedMessages.sort(function(a,b) {return a.sequence - b.sequence;} );
          for (var i=0, len=sequencedMessages.length; i<len; i++) {
            var sentMessage = sequencedMessages[i];
            if (sentMessage.type == MESSAGE_TYPE.PUBLISH && sentMessage.pubRecReceived) {
              var pubRelMessage = new WireMessage(MESSAGE_TYPE.PUBREL, {messageIdentifier:sentMessage.messageIdentifier});
              this._schedule_message(pubRelMessage);
            } else {
              this._schedule_message(sentMessage);
            };
          }

          // Execute the connectOptions.onSuccess callback if there is one.
          if (this.connectOptions.onSuccess) {
            this.connectOptions.onSuccess({invocationContext:this.connectOptions.invocationContext});
          }

          // Process all queued messages now that the connection is established.
          this._process_queue();
          break;

        case MESSAGE_TYPE.PUBLISH:
          this._receivePublish(wireMessage);
          break;

        case MESSAGE_TYPE.PUBACK:
          var sentMessage = this._sentMessages[wireMessage.messageIdentifier];
          // If this is a re flow of a PUBACK after we have restarted receivedMessage will not exist.
          if (sentMessage) {
            delete this._sentMessages[wireMessage.messageIdentifier];
            localStorage.removeItem("Sent:"+this._localKey+wireMessage.messageIdentifier);
            if (this.onMessageDelivered)
              this.onMessageDelivered(sentMessage.payloadMessage);
          }
          break;

        case MESSAGE_TYPE.PUBREC:
          var sentMessage = this._sentMessages[wireMessage.messageIdentifier];
          // If this is a re flow of a PUBREC after we have restarted receivedMessage will not exist.
          if (sentMessage) {
            sentMessage.pubRecReceived = true;
            var pubRelMessage = new WireMessage(MESSAGE_TYPE.PUBREL, {messageIdentifier:wireMessage.messageIdentifier});
            this.store("Sent:", sentMessage);
            this._schedule_message(pubRelMessage);
          }
          break;

        case MESSAGE_TYPE.PUBREL:
          var receivedMessage = this._receivedMessages[wireMessage.messageIdentifier];
          localStorage.removeItem("Received:"+this._localKey+wireMessage.messageIdentifier);
          // If this is a re flow of a PUBREL after we have restarted receivedMessage will not exist.
          if (receivedMessage) {
            this._receiveMessage(receivedMessage);
            delete this._receivedMessages[wireMessage.messageIdentifier];
          }
          // Always flow PubComp, we may have previously flowed PubComp but the server lost it and restarted.
          pubCompMessage = new WireMessage(MESSAGE_TYPE.PUBCOMP, {messageIdentifier:wireMessage.messageIdentifier});
          this._schedule_message(pubCompMessage);


          break;

        case MESSAGE_TYPE.PUBCOMP:
          var sentMessage = this._sentMessages[wireMessage.messageIdentifier];
          delete this._sentMessages[wireMessage.messageIdentifier];
          localStorage.removeItem("Sent:"+this._localKey+wireMessage.messageIdentifier);
          if (this.onMessageDelivered)
            this.onMessageDelivered(sentMessage.payloadMessage);
          break;

        case MESSAGE_TYPE.SUBACK:
          var sentMessage = this._sentMessages[wireMessage.messageIdentifier];
          if (sentMessage) {
            if(sentMessage.timeOut)
              sentMessage.timeOut.cancel();
            wireMessage.returnCode.indexOf = Array.prototype.indexOf;
            if (wireMessage.returnCode.indexOf(0x80) !== -1) {
              if (sentMessage.onFailure) {
                sentMessage.onFailure(wireMessage.returnCode);
              }
            } else if (sentMessage.onSuccess) {
              sentMessage.onSuccess(wireMessage.returnCode);
            }
            delete this._sentMessages[wireMessage.messageIdentifier];
          }
          break;

        case MESSAGE_TYPE.UNSUBACK:
          var sentMessage = this._sentMessages[wireMessage.messageIdentifier];
          if (sentMessage) {
            if (sentMessage.timeOut)
              sentMessage.timeOut.cancel();
            if (sentMessage.callback) {
              sentMessage.callback();
            }
            delete this._sentMessages[wireMessage.messageIdentifier];
          }

          break;

        case MESSAGE_TYPE.PINGRESP:
          /* The sendPinger or receivePinger may have sent a ping, the receivePinger has already been reset. */
          this.sendPinger.reset();
          break;

        case MESSAGE_TYPE.DISCONNECT:
          // Clients do not expect to receive disconnect packets.
          this._disconnected(ERROR.INVALID_MQTT_MESSAGE_TYPE.code , format(ERROR.INVALID_MQTT_MESSAGE_TYPE, [wireMessage.type]));
          break;

        default:
          this._disconnected(ERROR.INVALID_MQTT_MESSAGE_TYPE.code , format(ERROR.INVALID_MQTT_MESSAGE_TYPE, [wireMessage.type]));
      };
    } catch (error) {
      this._disconnected(ERROR.INTERNAL_ERROR.code , format(ERROR.INTERNAL_ERROR, [error.message]));
      return;
    }
  };

  /** @ignore */
  ClientImpl.prototype._on_socket_error = function (error) {
    this._disconnected(ERROR.SOCKET_ERROR.code , format(ERROR.SOCKET_ERROR, [error.data]));
  };

  /** @ignore */
  ClientImpl.prototype._on_socket_close = function () {
    this._disconnected(ERROR.SOCKET_CLOSE.code , format(ERROR.SOCKET_CLOSE));
  };

  /** @ignore */
  ClientImpl.prototype._socket_send = function (wireMessage) {

    if (wireMessage.type == 1) {
      var wireMessageMasked = this._traceMask(wireMessage, "password");
      this._trace("Client._socket_send", wireMessageMasked);
    }
    else this._trace("Client._socket_send", wireMessage);

    this.socket.send(wireMessage.encode());
    /* We have proved to the server we are alive. */
    this.sendPinger.reset();
  };

  /** @ignore */
  ClientImpl.prototype._receivePublish = function (wireMessage) {
    switch(wireMessage.payloadMessage.qos) {
      case "undefined":
      case 0:
        this._receiveMessage(wireMessage);
        break;

      case 1:
        var pubAckMessage = new WireMessage(MESSAGE_TYPE.PUBACK, {messageIdentifier:wireMessage.messageIdentifier});
        this._schedule_message(pubAckMessage);
        this._receiveMessage(wireMessage);
        break;

      case 2:
        this._receivedMessages[wireMessage.messageIdentifier] = wireMessage;
        this.store("Received:", wireMessage);
        var pubRecMessage = new WireMessage(MESSAGE_TYPE.PUBREC, {messageIdentifier:wireMessage.messageIdentifier});
        this._schedule_message(pubRecMessage);

        break;

      default:
        throw Error("Invaild qos="+wireMmessage.payloadMessage.qos);
    };
  };

  /** @ignore */
  ClientImpl.prototype._receiveMessage = function (wireMessage) {
    if (this.onMessageArrived) {
      this.onMessageArrived(wireMessage.payloadMessage);
    }
  };

  /**
   * Client has disconnected either at its own request or because the server
   * or network disconnected it. Remove all non-durable state.
   * @param {errorCode} [number] the error number.
   * @param {errorText} [string] the error text.
   * @ignore
   */
  ClientImpl.prototype._disconnected = function (errorCode, errorText) {
    this._trace("Client._disconnected", errorCode, errorText);

    this.sendPinger.cancel();
    this.receivePinger.cancel();
    if (this._connectTimeout)
      this._connectTimeout.cancel();
    // Clear message buffers.
    this._msg_queue = [];
    this._notify_msg_sent = {};

    if (this.socket) {
      // Cancel all socket callbacks so that they cannot be driven again by this socket.
      this.socket.onopen = null;
      this.socket.onmessage = null;
      this.socket.onerror = null;
      this.socket.onclose = null;
      if (this.socket.readyState === 1)
        this.socket.close();
      delete this.socket;
    }

    if (this.connectOptions.uris && this.hostIndex < this.connectOptions.uris.length-1) {
      // Try the next host.
      this.hostIndex++;
      this._doConnect(this.connectOptions.uris[this.hostIndex]);

    } else {

      if (errorCode === undefined) {
        errorCode = ERROR.OK.code;
        errorText = format(ERROR.OK);
      }

      // Run any application callbacks last as they may attempt to reconnect and hence create a new socket.
      if (this.connected) {
        this.connected = false;
        // Execute the connectionLostCallback if there is one, and we were connected.
        if (this.onConnectionLost)
          this.onConnectionLost({errorCode:errorCode, errorMessage:errorText});
      } else {
        // Otherwise we never had a connection, so indicate that the connect has failed.
        if (this.connectOptions.mqttVersion === 4 && this.connectOptions.mqttVersionExplicit === false) {
          this._trace("Failed to connect V4, dropping back to V3")
          this.connectOptions.mqttVersion = 3;
          if (this.connectOptions.uris) {
            this.hostIndex = 0;
            this._doConnect(this.connectOptions.uris[0]);
          } else {
            this._doConnect(this.uri);
          }
        } else if(this.connectOptions.onFailure) {
          this.connectOptions.onFailure({invocationContext:this.connectOptions.invocationContext, errorCode:errorCode, errorMessage:errorText});
        }
      }
    }
  };

  /** @ignore */
  ClientImpl.prototype._trace = function () {
    if ( this._traceBuffer !== null ) {
      for (var i = 0, max = arguments.length; i < max; i++) {
        if ( this._traceBuffer.length == this._MAX_TRACE_ENTRIES ) {
          this._traceBuffer.shift();
        }
        if (i === 0) this._traceBuffer.push(arguments[i]);
        else if (typeof arguments[i] === "undefined" ) this._traceBuffer.push(arguments[i]);
        else this._traceBuffer.push("  "+JSON.stringify(arguments[i]));
      };
    };
  };

  /** @ignore */
  ClientImpl.prototype._traceMask = function (traceObject, masked) {
    var traceObjectMasked = {};
    for (var attr in traceObject) {
      if (traceObject.hasOwnProperty(attr)) {
        if (attr == masked)
          traceObjectMasked[attr] = "******";
        else
          traceObjectMasked[attr] = traceObject[attr];
      }
    }
    return traceObjectMasked;
  };

  // ------------------------------------------------------------------------
  // Public Programming interface.
  // ------------------------------------------------------------------------

  /**
   * The JavaScript application communicates to the server using a {@link Paho.MQTT.Client} object.
   * <p>
   * Most applications will create just one Client object and then call its connect() method,
   * however applications can create more than one Client object if they wish.
   * In this case the combination of host, port and clientId attributes must be different for each Client object.
   * <p>
   * The send, subscribe and unsubscribe methods are implemented as asynchronous JavaScript methods
   * (even though the underlying protocol exchange might be synchronous in nature).
   * This means they signal their completion by calling back to the application,
   * via Success or Failure callback functions provided by the application on the method in question.
   * Such callbacks are called at most once per method invocation and do not persist beyond the lifetime
   * of the script that made the invocation.
   * <p>
   * In contrast there are some callback functions, most notably <i>onMessageArrived</i>,
   * that are defined on the {@link Paho.MQTT.Client} object.
   * These may get called multiple times, and aren't directly related to specific method invocations made by the client.
   *
   * @name Paho.MQTT.Client
   *
   * @constructor
   *
   * @param {string} host - the address of the messaging server, as a fully qualified WebSocket URI, as a DNS name or dotted decimal IP address.
   * @param {number} port - the port number to connect to - only required if host is not a URI
   * @param {string} path - the path on the host to connect to - only used if host is not a URI. Default: '/mqtt'.
   * @param {string} clientId - the Messaging client identifier, between 1 and 23 characters in length.
   *
   * @property {string} host - <i>read only</i> the server's DNS hostname or dotted decimal IP address.
   * @property {number} port - <i>read only</i> the server's port.
   * @property {string} path - <i>read only</i> the server's path.
   * @property {string} clientId - <i>read only</i> used when connecting to the server.
   * @property {function} onConnectionLost - called when a connection has been lost.
   *                            after a connect() method has succeeded.
   *                            Establish the call back used when a connection has been lost. The connection may be
   *                            lost because the client initiates a disconnect or because the server or network
   *                            cause the client to be disconnected. The disconnect call back may be called without
   *                            the connectionComplete call back being invoked if, for example the client fails to
   *                            connect.
   *                            A single response object parameter is passed to the onConnectionLost callback containing the following fields:
   *                            <ol>
   *                            <li>errorCode
   *                            <li>errorMessage
   *                            </ol>
   * @property {function} onMessageDelivered called when a message has been delivered.
   *                            All processing that this Client will ever do has been completed. So, for example,
   *                            in the case of a Qos=2 message sent by this client, the PubComp flow has been received from the server
   *                            and the message has been removed from persistent storage before this callback is invoked.
   *                            Parameters passed to the onMessageDelivered callback are:
   *                            <ol>
   *                            <li>{@link Paho.MQTT.Message} that was delivered.
   *                            </ol>
   * @property {function} onMessageArrived called when a message has arrived in this Paho.MQTT.client.
   *                            Parameters passed to the onMessageArrived callback are:
   *                            <ol>
   *                            <li>{@link Paho.MQTT.Message} that has arrived.
   *                            </ol>
   */
  var Client = function (host, port, path, clientId) {

    var uri;

    if (typeof host !== "string")
      throw new Error(format(ERROR.INVALID_TYPE, [typeof host, "host"]));

    if (arguments.length == 2) {
      // host: must be full ws:// uri
      // port: clientId
      clientId = port;
      uri = host;
      var match = uri.match(/^(wss?):\/\/((\[(.+)\])|([^\/]+?))(:(\d+))?(\/.*)$/);
      if (match) {
        host = match[4]||match[2];
        port = parseInt(match[7]);
        path = match[8];
      } else {
        throw new Error(format(ERROR.INVALID_ARGUMENT,[host,"host"]));
      }
    } else {
      if (arguments.length == 3) {
        clientId = path;
        path = "/mqtt";
      }
      if (typeof port !== "number" || port < 0)
        throw new Error(format(ERROR.INVALID_TYPE, [typeof port, "port"]));
      if (typeof path !== "string")
        throw new Error(format(ERROR.INVALID_TYPE, [typeof path, "path"]));

      var ipv6AddSBracket = (host.indexOf(":") != -1 && host.slice(0,1) != "[" && host.slice(-1) != "]");
      uri = "ws://"+(ipv6AddSBracket?"["+host+"]":host)+":"+port+path;
    }

    var clientIdLength = 0;
    for (var i = 0; i<clientId.length; i++) {
      var charCode = clientId.charCodeAt(i);
      if (0xD800 <= charCode && charCode <= 0xDBFF)  {
        i++; // Surrogate pair.
      }
      clientIdLength++;
    }
    if (typeof clientId !== "string" || clientIdLength > 65535)
      throw new Error(format(ERROR.INVALID_ARGUMENT, [clientId, "clientId"]));

    var client = new ClientImpl(uri, host, port, path, clientId);
    this._getHost =  function() { return host; };
    this._setHost = function() { throw new Error(format(ERROR.UNSUPPORTED_OPERATION)); };

    this._getPort = function() { return port; };
    this._setPort = function() { throw new Error(format(ERROR.UNSUPPORTED_OPERATION)); };

    this._getPath = function() { return path; };
    this._setPath = function() { throw new Error(format(ERROR.UNSUPPORTED_OPERATION)); };

    this._getURI = function() { return uri; };
    this._setURI = function() { throw new Error(format(ERROR.UNSUPPORTED_OPERATION)); };

    this._getClientId = function() { return client.clientId; };
    this._setClientId = function() { throw new Error(format(ERROR.UNSUPPORTED_OPERATION)); };

    this._getOnConnectionLost = function() { return client.onConnectionLost; };
    this._setOnConnectionLost = function(newOnConnectionLost) {
      if (typeof newOnConnectionLost === "function")
        client.onConnectionLost = newOnConnectionLost;
      else
        throw new Error(format(ERROR.INVALID_TYPE, [typeof newOnConnectionLost, "onConnectionLost"]));
    };

    this._getOnMessageDelivered = function() { return client.onMessageDelivered; };
    this._setOnMessageDelivered = function(newOnMessageDelivered) {
      if (typeof newOnMessageDelivered === "function")
        client.onMessageDelivered = newOnMessageDelivered;
      else
        throw new Error(format(ERROR.INVALID_TYPE, [typeof newOnMessageDelivered, "onMessageDelivered"]));
    };

    this._getOnMessageArrived = function() { return client.onMessageArrived; };
    this._setOnMessageArrived = function(newOnMessageArrived) {
      if (typeof newOnMessageArrived === "function")
        client.onMessageArrived = newOnMessageArrived;
      else
        throw new Error(format(ERROR.INVALID_TYPE, [typeof newOnMessageArrived, "onMessageArrived"]));
    };

    /**
     * Connect this Messaging client to its server.
     *
     * @name Paho.MQTT.Client#connect
     * @function
     * @param {Object} connectOptions - attributes used with the connection.
     * @param {number} connectOptions.timeout - If the connect has not succeeded within this
     *                    number of seconds, it is deemed to have failed.
     *                    The default is 30 seconds.
     * @param {string} connectOptions.userName - Authentication username for this connection.
     * @param {string} connectOptions.password - Authentication password for this connection.
     * @param {Paho.MQTT.Message} connectOptions.willMessage - sent by the server when the client
     *                    disconnects abnormally.
     * @param {Number} connectOptions.keepAliveInterval - the server disconnects this client if
     *                    there is no activity for this number of seconds.
     *                    The default value of 60 seconds is assumed if not set.
     * @param {boolean} connectOptions.cleanSession - if true(default) the client and server
     *                    persistent state is deleted on successful connect.
     * @param {boolean} connectOptions.useSSL - if present and true, use an SSL Websocket connection.
     * @param {object} connectOptions.invocationContext - passed to the onSuccess callback or onFailure callback.
     * @param {function} connectOptions.onSuccess - called when the connect acknowledgement
     *                    has been received from the server.
     * A single response object parameter is passed to the onSuccess callback containing the following fields:
     * <ol>
     * <li>invocationContext as passed in to the onSuccess method in the connectOptions.
     * </ol>
     * @config {function} [onFailure] called when the connect request has failed or timed out.
     * A single response object parameter is passed to the onFailure callback containing the following fields:
     * <ol>
     * <li>invocationContext as passed in to the onFailure method in the connectOptions.
     * <li>errorCode a number indicating the nature of the error.
     * <li>errorMessage text describing the error.
     * </ol>
     * @config {Array} [hosts] If present this contains either a set of hostnames or fully qualified
     * WebSocket URIs (ws://example.com:1883/mqtt), that are tried in order in place
     * of the host and port paramater on the construtor. The hosts are tried one at at time in order until
     * one of then succeeds.
     * @config {Array} [ports] If present the set of ports matching the hosts. If hosts contains URIs, this property
     * is not used.
     * @throws {InvalidState} if the client is not in disconnected state. The client must have received connectionLost
     * or disconnected before calling connect for a second or subsequent time.
     */
    this.connect = function (connectOptions) {
      connectOptions = connectOptions || {} ;
      validate(connectOptions,  {timeout:"number",
        userName:"string",
        password:"string",
        willMessage:"object",
        keepAliveInterval:"number",
        cleanSession:"boolean",
        useSSL:"boolean",
        invocationContext:"object",
        onSuccess:"function",
        onFailure:"function",
        hosts:"object",
        ports:"object",
        mqttVersion:"number"});

      // If no keep alive interval is set, assume 60 seconds.
      if (connectOptions.keepAliveInterval === undefined)
        connectOptions.keepAliveInterval = 60;

      if (connectOptions.mqttVersion > 4 || connectOptions.mqttVersion < 3) {
        throw new Error(format(ERROR.INVALID_ARGUMENT, [connectOptions.mqttVersion, "connectOptions.mqttVersion"]));
      }

      if (connectOptions.mqttVersion === undefined) {
        connectOptions.mqttVersionExplicit = false;
        connectOptions.mqttVersion = 4;
      } else {
        connectOptions.mqttVersionExplicit = true;
      }

      //Check that if password is set, so is username
      if (connectOptions.password === undefined && connectOptions.userName !== undefined)
        throw new Error(format(ERROR.INVALID_ARGUMENT, [connectOptions.password, "connectOptions.password"]))

      if (connectOptions.willMessage) {
        if (!(connectOptions.willMessage instanceof Message))
          throw new Error(format(ERROR.INVALID_TYPE, [connectOptions.willMessage, "connectOptions.willMessage"]));
        // The will message must have a payload that can be represented as a string.
        // Cause the willMessage to throw an exception if this is not the case.
        connectOptions.willMessage.stringPayload;

        if (typeof connectOptions.willMessage.destinationName === "undefined")
          throw new Error(format(ERROR.INVALID_TYPE, [typeof connectOptions.willMessage.destinationName, "connectOptions.willMessage.destinationName"]));
      }
      if (typeof connectOptions.cleanSession === "undefined")
        connectOptions.cleanSession = true;
      if (connectOptions.hosts) {

        if (!(connectOptions.hosts instanceof Array) )
          throw new Error(format(ERROR.INVALID_ARGUMENT, [connectOptions.hosts, "connectOptions.hosts"]));
        if (connectOptions.hosts.length <1 )
          throw new Error(format(ERROR.INVALID_ARGUMENT, [connectOptions.hosts, "connectOptions.hosts"]));

        var usingURIs = false;
        for (var i = 0; i<connectOptions.hosts.length; i++) {
          if (typeof connectOptions.hosts[i] !== "string")
            throw new Error(format(ERROR.INVALID_TYPE, [typeof connectOptions.hosts[i], "connectOptions.hosts["+i+"]"]));
          if (/^(wss?):\/\/((\[(.+)\])|([^\/]+?))(:(\d+))?(\/.*)$/.test(connectOptions.hosts[i])) {
            if (i == 0) {
              usingURIs = true;
            } else if (!usingURIs) {
              throw new Error(format(ERROR.INVALID_ARGUMENT, [connectOptions.hosts[i], "connectOptions.hosts["+i+"]"]));
            }
          } else if (usingURIs) {
            throw new Error(format(ERROR.INVALID_ARGUMENT, [connectOptions.hosts[i], "connectOptions.hosts["+i+"]"]));
          }
        }

        if (!usingURIs) {
          if (!connectOptions.ports)
            throw new Error(format(ERROR.INVALID_ARGUMENT, [connectOptions.ports, "connectOptions.ports"]));
          if (!(connectOptions.ports instanceof Array) )
            throw new Error(format(ERROR.INVALID_ARGUMENT, [connectOptions.ports, "connectOptions.ports"]));
          if (connectOptions.hosts.length != connectOptions.ports.length)
            throw new Error(format(ERROR.INVALID_ARGUMENT, [connectOptions.ports, "connectOptions.ports"]));

          connectOptions.uris = [];

          for (var i = 0; i<connectOptions.hosts.length; i++) {
            if (typeof connectOptions.ports[i] !== "number" || connectOptions.ports[i] < 0)
              throw new Error(format(ERROR.INVALID_TYPE, [typeof connectOptions.ports[i], "connectOptions.ports["+i+"]"]));
            var host = connectOptions.hosts[i];
            var port = connectOptions.ports[i];

            var ipv6 = (host.indexOf(":") != -1);
            uri = "ws://"+(ipv6?"["+host+"]":host)+":"+port+path;
            connectOptions.uris.push(uri);
          }
        } else {
          connectOptions.uris = connectOptions.hosts;
        }
      }

      client.connect(connectOptions);
    };

    /**
     * Subscribe for messages, request receipt of a copy of messages sent to the destinations described by the filter.
     *
     * @name Paho.MQTT.Client#subscribe
     * @function
     * @param {string} filter describing the destinations to receive messages from.
     * <br>
     * @param {object} subscribeOptions - used to control the subscription
     *
     * @param {number} subscribeOptions.qos - the maiximum qos of any publications sent
     *                                  as a result of making this subscription.
     * @param {object} subscribeOptions.invocationContext - passed to the onSuccess callback
     *                                  or onFailure callback.
     * @param {function} subscribeOptions.onSuccess - called when the subscribe acknowledgement
     *                                  has been received from the server.
     *                                  A single response object parameter is passed to the onSuccess callback containing the following fields:
     *                                  <ol>
     *                                  <li>invocationContext if set in the subscribeOptions.
     *                                  </ol>
     * @param {function} subscribeOptions.onFailure - called when the subscribe request has failed or timed out.
     *                                  A single response object parameter is passed to the onFailure callback containing the following fields:
     *                                  <ol>
     *                                  <li>invocationContext - if set in the subscribeOptions.
     *                                  <li>errorCode - a number indicating the nature of the error.
     *                                  <li>errorMessage - text describing the error.
     *                                  </ol>
     * @param {number} subscribeOptions.timeout - which, if present, determines the number of
     *                                  seconds after which the onFailure calback is called.
     *                                  The presence of a timeout does not prevent the onSuccess
     *                                  callback from being called when the subscribe completes.
     * @throws {InvalidState} if the client is not in connected state.
     */
    this.subscribe = function (filter, subscribeOptions) {
      if (typeof filter !== "string")
        throw new Error("Invalid argument:"+filter);
      subscribeOptions = subscribeOptions || {} ;
      validate(subscribeOptions,  {qos:"number",
        invocationContext:"object",
        onSuccess:"function",
        onFailure:"function",
        timeout:"number"
      });
      if (subscribeOptions.timeout && !subscribeOptions.onFailure)
        throw new Error("subscribeOptions.timeout specified with no onFailure callback.");
      if (typeof subscribeOptions.qos !== "undefined"
        && !(subscribeOptions.qos === 0 || subscribeOptions.qos === 1 || subscribeOptions.qos === 2 ))
        throw new Error(format(ERROR.INVALID_ARGUMENT, [subscribeOptions.qos, "subscribeOptions.qos"]));
      client.subscribe(filter, subscribeOptions);
    };

    /**
     * Unsubscribe for messages, stop receiving messages sent to destinations described by the filter.
     *
     * @name Paho.MQTT.Client#unsubscribe
     * @function
     * @param {string} filter - describing the destinations to receive messages from.
     * @param {object} unsubscribeOptions - used to control the subscription
     * @param {object} unsubscribeOptions.invocationContext - passed to the onSuccess callback
     or onFailure callback.
     * @param {function} unsubscribeOptions.onSuccess - called when the unsubscribe acknowledgement has been received from the server.
     *                                    A single response object parameter is passed to the
     *                                    onSuccess callback containing the following fields:
     *                                    <ol>
     *                                    <li>invocationContext - if set in the unsubscribeOptions.
     *                                    </ol>
     * @param {function} unsubscribeOptions.onFailure called when the unsubscribe request has failed or timed out.
     *                                    A single response object parameter is passed to the onFailure callback containing the following fields:
     *                                    <ol>
     *                                    <li>invocationContext - if set in the unsubscribeOptions.
     *                                    <li>errorCode - a number indicating the nature of the error.
     *                                    <li>errorMessage - text describing the error.
     *                                    </ol>
     * @param {number} unsubscribeOptions.timeout - which, if present, determines the number of seconds
     *                                    after which the onFailure callback is called. The presence of
     *                                    a timeout does not prevent the onSuccess callback from being
     *                                    called when the unsubscribe completes
     * @throws {InvalidState} if the client is not in connected state.
     */
    this.unsubscribe = function (filter, unsubscribeOptions) {
      if (typeof filter !== "string")
        throw new Error("Invalid argument:"+filter);
      unsubscribeOptions = unsubscribeOptions || {} ;
      validate(unsubscribeOptions,  {invocationContext:"object",
        onSuccess:"function",
        onFailure:"function",
        timeout:"number"
      });
      if (unsubscribeOptions.timeout && !unsubscribeOptions.onFailure)
        throw new Error("unsubscribeOptions.timeout specified with no onFailure callback.");
      client.unsubscribe(filter, unsubscribeOptions);
    };

    /**
     * Send a message to the consumers of the destination in the Message.
     *
     * @name Paho.MQTT.Client#send
     * @function
     * @param {Paho.MQTT.Message} message to send.

     * @throws {InvalidState} if the client is not connected.
     */
    this.send = function (message) {
      if (!(message instanceof Message))
        throw new Error("Invalid argument:"+typeof message);
      if (typeof message.destinationName === "undefined")
        throw new Error("Invalid parameter Message.destinationName:"+message.destinationName);

      client.send(message);
    };

    /**
     * Normal disconnect of this Messaging client from its server.
     *
     * @name Paho.MQTT.Client#disconnect
     * @function
     * @throws {InvalidState} if the client is already disconnected.
     */
    this.disconnect = function () {
      client.disconnect();
    };

    /**
     * Get the contents of the trace log.
     *
     * @name Paho.MQTT.Client#getTraceLog
     * @function
     * @return {Object[]} tracebuffer containing the time ordered trace records.
     */
    this.getTraceLog = function () {
      return client.getTraceLog();
    }

    /**
     * Start tracing.
     *
     * @name Paho.MQTT.Client#startTrace
     * @function
     */
    this.startTrace = function () {
      client.startTrace();
    };

    /**
     * Stop tracing.
     *
     * @name Paho.MQTT.Client#stopTrace
     * @function
     */
    this.stopTrace = function () {
      client.stopTrace();
    };

    this.isConnected = function() {
      return client.connected;
    };
  };

  Client.prototype = {
    get host() { return this._getHost(); },
    set host(newHost) { this._setHost(newHost); },

    get port() { return this._getPort(); },
    set port(newPort) { this._setPort(newPort); },

    get path() { return this._getPath(); },
    set path(newPath) { this._setPath(newPath); },

    get clientId() { return this._getClientId(); },
    set clientId(newClientId) { this._setClientId(newClientId); },

    get onConnectionLost() { return this._getOnConnectionLost(); },
    set onConnectionLost(newOnConnectionLost) { this._setOnConnectionLost(newOnConnectionLost); },

    get onMessageDelivered() { return this._getOnMessageDelivered(); },
    set onMessageDelivered(newOnMessageDelivered) { this._setOnMessageDelivered(newOnMessageDelivered); },

    get onMessageArrived() { return this._getOnMessageArrived(); },
    set onMessageArrived(newOnMessageArrived) { this._setOnMessageArrived(newOnMessageArrived); }
  };

  /**
   * An application message, sent or received.
   * <p>
   * All attributes may be null, which implies the default values.
   *
   * @name Paho.MQTT.Message
   * @constructor
   * @param {String|ArrayBuffer} payload The message data to be sent.
   * <p>
   * @property {string} payloadString <i>read only</i> The payload as a string if the payload consists of valid UTF-8 characters.
   * @property {ArrayBuffer} payloadBytes <i>read only</i> The payload as an ArrayBuffer.
   * <p>
   * @property {string} destinationName <b>mandatory</b> The name of the destination to which the message is to be sent
   *                    (for messages about to be sent) or the name of the destination from which the message has been received.
   *                    (for messages received by the onMessage function).
   * <p>
   * @property {number} qos The Quality of Service used to deliver the message.
   * <dl>
   *     <dt>0 Best effort (default).
   *     <dt>1 At least once.
   *     <dt>2 Exactly once.
   * </dl>
   * <p>
   * @property {Boolean} retained If true, the message is to be retained by the server and delivered
   *                     to both current and future subscriptions.
   *                     If false the server only delivers the message to current subscribers, this is the default for new Messages.
   *                     A received message has the retained boolean set to true if the message was published
   *                     with the retained boolean set to true
   *                     and the subscrption was made after the message has been published.
   * <p>
   * @property {Boolean} duplicate <i>read only</i> If true, this message might be a duplicate of one which has already been received.
   *                     This is only set on messages received from the server.
   *
   */
  var Message = function (newPayload) {
    var payload;
    if (   typeof newPayload === "string"
      || newPayload instanceof ArrayBuffer
      || newPayload instanceof Int8Array
      || newPayload instanceof Uint8Array
      || newPayload instanceof Int16Array
      || newPayload instanceof Uint16Array
      || newPayload instanceof Int32Array
      || newPayload instanceof Uint32Array
      || newPayload instanceof Float32Array
      || newPayload instanceof Float64Array
      ) {
      payload = newPayload;
    } else {
      throw (format(ERROR.INVALID_ARGUMENT, [newPayload, "newPayload"]));
    }

    this._getPayloadString = function () {
      if (typeof payload === "string")
        return payload;
      else
        return parseUTF8(payload, 0, payload.length);
    };

    this._getPayloadBytes = function() {
      if (typeof payload === "string") {
        var buffer = new ArrayBuffer(UTF8Length(payload));
        var byteStream = new Uint8Array(buffer);
        stringToUTF8(payload, byteStream, 0);

        return byteStream;
      } else {
        return payload;
      };
    };

    var destinationName = undefined;
    this._getDestinationName = function() { return destinationName; };
    this._setDestinationName = function(newDestinationName) {
      if (typeof newDestinationName === "string")
        destinationName = newDestinationName;
      else
        throw new Error(format(ERROR.INVALID_ARGUMENT, [newDestinationName, "newDestinationName"]));
    };

    var qos = 0;
    this._getQos = function() { return qos; };
    this._setQos = function(newQos) {
      if (newQos === 0 || newQos === 1 || newQos === 2 )
        qos = newQos;
      else
        throw new Error("Invalid argument:"+newQos);
    };

    var retained = false;
    this._getRetained = function() { return retained; };
    this._setRetained = function(newRetained) {
      if (typeof newRetained === "boolean")
        retained = newRetained;
      else
        throw new Error(format(ERROR.INVALID_ARGUMENT, [newRetained, "newRetained"]));
    };

    var duplicate = false;
    this._getDuplicate = function() { return duplicate; };
    this._setDuplicate = function(newDuplicate) { duplicate = newDuplicate; };
  };

  Message.prototype = {
    get payloadString() { return this._getPayloadString(); },
    get payloadBytes() { return this._getPayloadBytes(); },

    get destinationName() { return this._getDestinationName(); },
    set destinationName(newDestinationName) { this._setDestinationName(newDestinationName); },

    get qos() { return this._getQos(); },
    set qos(newQos) { this._setQos(newQos); },

    get retained() { return this._getRetained(); },
    set retained(newRetained) { this._setRetained(newRetained); },

    get duplicate() { return this._getDuplicate(); },
    set duplicate(newDuplicate) { this._setDuplicate(newDuplicate); }
  };

  // Module contents.
  return {
    Client: Client,
    Message: Message
  };
})(window);
(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.musher = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var Socket = require('./lib/socket');

exports.connect = function (key, settings) {
    if (typeof key === 'object') {
        settings = key;
        key = null;
    }
    settings = settings || {};
    if (key) settings.key = key;
    return new Socket(require('./lib/adapters/paho'), settings);
};

exports.Socket = Socket;
exports.utils = require('./lib/utils');

},{"./lib/adapters/paho":2,"./lib/socket":7,"./lib/utils":8}],2:[function(require,module,exports){
"use strict";
var merge = require('utils-merge');
var Emitter = require('../emitter');

var defaultPort = 3883;
var defaultSecurePort = 4883;

/**
 * http://git.eclipse.org/c/paho/org.eclipse.paho.mqtt.javascript.git/tree/src/mqttws31.js
 */

exports.initialize = function initialize(socket, utils) {
    var settings = socket.settings || {};

    var host = settings.options.host || settings.host || defaultHost;
    var port = Number(settings.options.port || settings.port || (settings.useSSL ? defaultSecurePort : defaultPort));
    var clientId = settings.options.clientId || settings.clientId || utils.makeId();

    var options = {};
    options.userName = settings.username || settings.key;
    options.password = settings.password || settings.secret;
    options.useSSL = !!settings.useSSL;

    merge(options, settings.options);
    merge(settings, options); // update settings

    delete options.host;
    delete options.port;
    delete options.clientId;

    Object.keys(options).forEach(function(key) {
        if (options[key] === null || options[key] === undefined) {
            delete options[key];
        }
    });

    if (options.userName && !options.password) delete options.userName;

    var client = socket.client = new Paho.MQTT.Client(host, port, clientId);
    socket.adapter = new PahoAdapter(client, options);
};

function PahoAdapter(client, options) {
    this.client = client;

    var adapter = this;
    client.onConnectionLost = function () {
        adapter.emit('close');
    };
    client.onMessageArrived = function (message) {
        adapter.emit('message', message.destinationName, message.payloadString);
    };

    options = options || {};
    options.onSuccess = function onConnected() {
        adapter.emit('connect');
    };
    options.onFailure = function (message) {
        adapter.emit(new Error(message.errorMessage));
    };

    client.connect(options);
}

Emitter.extend(PahoAdapter);

PahoAdapter.prototype.__defineGetter__('connected', function () {
    return this.client.connected;
});

PahoAdapter.prototype.subscribe = function (topic, opts, cb) {
    opts = opts || {qos: 1};
    cb = cb || function () {};
    opts.onSuccess = function (messsage) {
        cb(null, messsage.grantedQos);
    };
    opts.onFailure = function (messsage) {
        cb(messsage.errorCode);
    };
    return this.client.subscribe(topic, opts);
};

PahoAdapter.prototype.unsubscribe = function (topic, opts, cb) {
    opts = opts || {};
    cb = cb || function () {};
    opts.onSuccess = function (messsage) {
        cb();
    };
    return this.client.unsubscribe(topic, opts);
};

PahoAdapter.prototype.publish = function (topic, message) {
    var m = new Paho.MQTT.Message(message);
    m.destinationName = topic;
    return this.client.send(m);
};

PahoAdapter.prototype.close = function () {
    try {
        this.client.disconnect();
    } catch (e) {
        console.warn(e.message);
        this.emit('close');
    }
};

},{"../emitter":5,"utils-merge":13}],3:[function(require,module,exports){
"use strict";

var Emitter = require('./emitter');

var __ID = 0;

module.exports = Channel;

function Channel(name, socket) {
    if (!(this instanceof Channel)) {
        return new Channel(name, socket);
    }
    this.id = __ID++;
    this.socket = socket;
    this.adapter = socket.adapter;
    this.name = name;
    this.topic = socket._wrap(format(name));
}

Emitter.extend(Channel);

Channel.prototype.bind = Channel.prototype.on;

Channel.prototype.subscribe = function (opts, cb) {
    if (typeof opts === 'function') {
        cb = opts;
        opts = undefined;
    }
    var that = this;
    this.adapter.subscribe(this.topic, opts, function (err) {
        if (cb) cb.call(that, err, that);
    });
    return this;
};

/**
 * unsubscribe - unsubscribe from channel
 *
 * @param {Function} [cb] - callback fired on unsuback
 * @returns {Channel} this - for chaining
 * @example channel.unsubscribe('topic');
 * @example channel.unsubscribe('topic', console.log);
 */
Channel.prototype.unsubscribe = function (cb) {
    this.adapter.unsubscribe(this.topic, {}, cb);
    return this;
};

Channel.prototype._handleMessage = function (message, route) {
    message = JSON.parse(message);
    var event = message.__event__ || route.params.event || 'message';
    var data = ('__data__' in message) ? message.__data__ : message;
    route.event = event;
    this.emit(event, data, route);
    if (this.handler) this.handler(data, route);
};

/**
 * Convenience method for publish through channel.
 *
 * @param event
 * @param data
 */
Channel.prototype.publish = function (event, data) {
    this.socket.publish(this.topic, event, data);
};

function format(path) {
    return path.replace(/\:[a-zA-Z0-9]+/g, "+")
        .replace(/\*\*/g, "#")
        .replace(/\*/g, "+");
}
},{"./emitter":5}],4:[function(require,module,exports){
"use strict";

var Channel = require('./channel');
var Router = require('./router');
var utils = require('./utils');

module.exports = Channels;

function Channels(socket) {
    this.socket = socket;
    this.key = socket.key;
    this.adapter = socket.adapter;

    this.router = Router();
    this._channels = {};
}

Channels.prototype.add = function (name, socket) {
    var channel = this._channels[name];
    if (channel) return channel;
    channel = this._channels[name] = createChannel(name, socket);
    this.router.addRoute(name, name);
    return channel;
};

Channels.prototype.remove = function (name) {
    var channel = this.find(name);
    if (channel) {
        delete this._channels[name];
        this.router.removeRoute(name);
    }

    return channel;
};

Channels.prototype.find = function (name) {
    return this._channels[name];
};

Channels.prototype.unsubscribeAll = function (cb) {
    if (!this._channels) return cb();
    var invokers = [];
    utils.each(this._channels, function (channel) {
        invokers.push(channel.unsubscribe.bind(channel));
    });
    return utils.parallel(invokers, cb);
};

Channels.prototype._handleMessage = function (topic, message) {
    topic = this.socket._unwrap(topic);
    var matched = this.router.match(topic);
    if (!matched) throw new Error('No channel to handle message with topic [' + topic + ']');
    var channel;
    while (matched) {
        channel = this._channels[matched.data];
        channel._handleMessage(message, {
            topic: topic,
            params: matched.params,
            splats: matched.splats,
            path: matched.route
        });
        matched = matched.next();
    }
};

function createChannel(name, socket) {
    return new Channel(name, socket);
}


},{"./channel":3,"./router":6,"./utils":8}],5:[function(require,module,exports){
"use strict";

var utils = require('./utils');

module.exports = Emitter;

function Emitter() {
}

/**
 * Mixin the emitter properties.
 *
 * @param {Object} obj
 * @return {Object}
 * @api private
 */

Emitter.mixin = function (obj) {
    utils.assign(obj, Emitter.prototype);
    return obj;
};

Emitter.extend = function (obj) {
    utils.assign(obj.prototype, Emitter.prototype);
    return obj;
};

/**
 * Listen on the given `event` with `fn`.
 *
 * @param {String} event
 * @param {Function} fn
 * @return {Emitter}
 * @api public
 */

Emitter.prototype.on =
    Emitter.prototype.addEventListener = function (event, fn) {
        this._callbacks = this._callbacks || {};
        (this._callbacks[event] = this._callbacks[event] || [])
            .push(fn);
        return this;
    };

/**
 * Adds an `event` listener that will be invoked a single
 * time then automatically removed.
 *
 * @param {String} event
 * @param {Function} fn
 * @return {Emitter}
 * @api public
 */

Emitter.prototype.once = function (event, fn) {
    var self = this;
    this._callbacks = this._callbacks || {};

    function on() {
        self.off(event, on);
        fn.apply(this, arguments);
    }

    on.fn = fn;
    this.on(event, on);
    return this;
};

/**
 * Remove the given callback for `event` or all
 * registered callbacks.
 *
 * @param {String} event
 * @param {Function} fn
 * @return {Emitter}
 * @api public
 */

Emitter.prototype.off =
    Emitter.prototype.removeListener =
        Emitter.prototype.removeAllListeners =
            Emitter.prototype.removeEventListener = function (event, fn) {
                this._callbacks = this._callbacks || {};

                // all
                if (0 == arguments.length) {
                    this._callbacks = {};
                    return this;
                }

                // specific event
                var callbacks = this._callbacks[event];
                if (!callbacks) return this;

                // remove all handlers
                if (1 == arguments.length) {
                    delete this._callbacks[event];
                    return this;
                }

                // remove specific handler
                var cb;
                for (var i = 0; i < callbacks.length; i++) {
                    cb = callbacks[i];
                    if (cb === fn || cb.fn === fn) {
                        callbacks.splice(i, 1);
                        break;
                    }
                }
                return this;
            };

/**
 * Emit `event` with the given args.
 *
 * @param {String} event
 * @param {Mixed} ...
 * @return {Emitter}
 */

Emitter.prototype.emit = function (event) {
    this._callbacks = this._callbacks || {};
    var args = [].slice.call(arguments, 1),
        callbacks = this._callbacks[event];

    if (callbacks) {
        callbacks = callbacks.slice(0);
        for (var i = 0, len = callbacks.length; i < len; ++i) {
            callbacks[i].apply(this, args);
        }
    }

    return this;
};

/**
 * Return array of callbacks for `event`.
 *
 * @param {String} event
 * @return {Array}
 * @api public
 */

Emitter.prototype.listeners = function (event) {
    this._callbacks = this._callbacks || {};
    return this._callbacks[event] || [];
};

/**
 * Check if this emitter has `event` handlers.
 *
 * @param {String} event
 * @return {Boolean}
 * @api public
 */

Emitter.prototype.hasListeners = function (event) {
    return !!this.listeners(event).length;
};

},{"./utils":8}],6:[function(require,module,exports){
/**
 * Convert path to route object
 *
 * A string or RegExp should be passed,
 * will return { re, src, keys} obj
 *
 * @param  {String / RegExp} path
 * @return {Object}
 */

var Route = function (path) {
    //using 'new' is optional

    var src, re, keys = [];

    if (path instanceof RegExp) {
        re = path;
        src = path.toString();
    } else {
        re = pathToRegExp(path, keys);
        src = path;
    }

    return {
        re: re,
        src: src,
        keys: keys
    }
};

/**
 * Normalize the given path string,
 * returning a regular expression.
 *
 * An empty array should be passed,
 * which will contain the placeholder
 * key names. For example "/user/:id" will
 * then contain ["id"].
 *
 * @param  {String} path
 * @param  {Array} keys
 * @return {RegExp}
 */
var pathToRegExp = function (path, keys) {
    path = path
        .concat('/?')
        .replace(/\/\(/g, '(?:/')
        .replace(/(\/)?(\.)?:(\w+)(?:(\(.*?\)))?(\?)?|\*/g, function (_, slash, format, key, capture, optional) {
            if (_ === "*") {
                keys.push(undefined);
                return _;
            }

            keys.push(key);
            slash = slash || '';
            return ''
                + (optional ? '' : slash)
                + '(?:'
                + (optional ? slash : '')
                + (format || '') + (capture || '([^/]+?)') + ')'
                + (optional || '');
        })
        .replace(/([\/.])/g, '\\$1')
        .replace(/\*/g, '(.*)');
    return new RegExp('^' + path + '$', 'i');
};

/**
 * Attempt to match the given request to
 * one of the routes. When successful
 * a  {fn, params, splats} obj is returned
 *
 * @param  {Array} routes
 * @param  {String} uri
 * @param  {Number} startAt
 * @return {Object}

 */
var match = function (routes, uri, startAt) {
    var captures, i = startAt || 0, len, j;

    for (len = routes.length; i < len; ++i) {
        var route = routes[i],
            re = route.re,
            keys = route.keys,
            splats = [],
            params = {};

        if (captures = uri.match(re)) {
            for (j = 1, len = captures.length; j < len; ++j) {
                var key = keys[j - 1],
                    val = typeof captures[j] === 'string'
                        ? decodeURI(captures[j])
                        : captures[j];
                if (key) {
                    params[key] = val;
                } else {
                    splats.push(val);
                }
            }
            return {
                params: params,
                splats: splats,
                route: route.src,
                next: i + 1
            };
        }
    }
};

/**
 * Default "normal" router constructor.
 * accepts path, data tuples via addRoute
 * returns {fn, params, splats, path}
 *  via match
 *
 * @return {Object}
 */

function Router() {
    this.routes = [];
}

Router.prototype.addRoute = function (path, data) {
    if (!path) throw new Error(' route requires a path');
    path = path.replace(/\$/, "\\$");
    var route = Route(path);
    route.data = data;

    this.routes.push(route);
};

Router.prototype.removeRoute = function (data) {
    if (!data) throw new Error('data must not be null');

    var i, len = this.routes.length;
    for (i = 0; i < len; i++) {
        if (this.routes[i].data === data) break;
    }
    if (i < len) this.routes.splice(i, 1);
};

Router.prototype.match = function (path, startAt) {
    var matched = match(this.routes, path, startAt);
    if (matched) {
        var route = this.routes[matched.next - 1];
        matched.data = route.data;
        matched.next = this.match.bind(this, path, matched.next)
    }
    return matched;
};

exports = module.exports = function () {
    return new Router();
};

exports.Route = Route;
exports.pathToRegExp = pathToRegExp;
exports.match = match;


},{}],7:[function(require,module,exports){
(function (process){
"use strict";
var debug = require('debug')('musher:socket');
var utils = require('./utils');
var Emitter = require('./emitter');
var Channels = require('./channels');

var defaultHost = 'musher.io';

module.exports = Socket;

function Socket(adapter, opts) {
    if (!(this instanceof Socket)) {
        return new Socket(adapter, opts);
    }

    // just save everything we get
    var settings = this.settings = utils.assign({host: defaultHost}, opts);
    this.key = settings.key;
    this.prefix = this.key ? '$' + this.key + ':' : null;

    var useSSL = settings.ssl || settings.secure;
    if (useSSL !== null && useSSL !== undefined) {
        settings.useSSL = !!useSSL;
    }
    settings.options = settings.options || {};

    this.queue = [];

    // initialize adapter
    adapter.initialize(this, utils);

    // we have an adapter now?
    if (!this.adapter) {
        throw new Error('Adapter is not defined correctly: it should create `adapter` member of socket');
    }

    this.channels = new Channels(this);

    var that = this;
    this.adapter.on('error', function (err) {
        that.emit('error', err)
    });
    this.adapter.on('connect', function () {
        that._connected();
    });
    this.adapter.on('reconnect', function () {
        that.emit('reconnect')
    });
    this.adapter.on('offline', function () {
        that.emit('offline')
    });
    this.adapter.on('close', function () {
        that._close();
    });
    this.adapter.on('message', function (topic, message, packet) {
        process.nextTick(function () {
            that._message(topic, message);
        });
    });
}

Emitter.extend(Socket);

Socket.prototype.__defineGetter__('connected', function () {
    return this.adapter.connected;
});

Socket.prototype._connected = function () {
    for (var i = 0; i < this.queue.length; i++) {
        this.queue[i]();
    }
    this.queue = [];
    this.emit('connected');
};

Socket.prototype._close = function () {
    this.emit('close');
};

Socket.prototype._enqueue = function (fn) {
    this.queue.push(fn);
};

Socket.prototype._message = function (topic, message) {
    this.channels._handleMessage(topic, message);
};

Socket.prototype._wrap = function (topic) {
    return this.prefix && topic.indexOf(this.prefix) !== 0 ? this.prefix + topic : topic;
};

Socket.prototype._unwrap = function (topic) {
    return this.prefix && topic.indexOf(this.prefix) === 0 ? topic.substring(this.prefix.length) : topic;
};

Socket.prototype.ready = function (fn) {
    if (this.connected) return fn();
    this._enqueue(fn);
};

Socket.prototype.close = function (cb) {
    if (cb) this.once('close', cb);
    this.adapter.close();
};

Socket.prototype.channel = function (name) {
    return this.channels.find(name);
};

/**
 *
 * @param topic
 * @param opts
 * @param handler function(data, route), `data` is the message body, `route` is an object includes:
 *  {topic: String, event: String = 'message', params: Object, slats: Array, path: String}
 */
Socket.prototype.subscribe = function (topic, opts, handler) {
    if (typeof opts === "function") {
        handler = opts;
        opts = null;
    }
    var channel = this.channels.add(topic, this);
    channel.handler = handler;
    this.ready(function () {
        channel.subscribe(opts, function (err) {
            if (err) throw err;
        });
    });
    return channel;
};

Socket.prototype.unsubscribe = function (name, cb) {
    cb = cb || utils.nop;
    var channel = this.channels.remove(name, cb);
    channel.handler = null;
    if (channel.connected) {
        channel.unsubscribe(cb);
    } else {
        cb();
    }
    return this;
};

Socket.prototype.publish = function (topic, event, data) {
    var socket = this;
    this.ready(function () {
        socket._publish(topic, event, data);
    });
    return this;
};

Socket.prototype._publish = function (topic, event, data) {
    if (!topic) throw new Error('`topic` must not be null');
    if (typeof event !== 'string') {
        data = event;
        event = null;
    }

    topic = this._wrap(topic);
    var message = JSON.stringify(event ? {__event__: event, __data__: data} : data);
    this.adapter.publish(topic, message);
};
}).call(this,require('_process'))
},{"./channels":4,"./emitter":5,"./utils":8,"_process":12,"debug":9}],8:[function(require,module,exports){
"use strict";

var breaker = {};

var ArrayProto = Array.prototype;

var nativeForEach = ArrayProto.forEach;
var slice = ArrayProto.slice;

exports = module.exports = {
    nop: nop,
    each: forEach,
    forEach: forEach,
    assign: assign,
    parallel: parallel,
    sure: sure,
    makeId: makeId,
    parseAuthOptions: parseAuthOptions,
    ensureSlashBefore: ensureSlashBefore
};

function nop() {
}

function forEach(obj, iterator, context) {
    if (obj == null) return;
    if (nativeForEach && obj.forEach === nativeForEach) {
        obj.forEach(iterator, context);
    } else if (obj.length === +obj.length) {
        for (var i = 0, length = obj.length; i < length; i++) {
            if (iterator.call(context, obj[i], i, obj) === breaker) return;
        }
    } else {
        var keys = obj.keys;
        for (var i = 0, length = keys.length; i < length; i++) {
            if (iterator.call(context, obj[keys[i]], keys[i], obj) === breaker) return;
        }
    }
}


function assign(obj) {
    forEach(slice.call(arguments, 1), function (source) {
        if (source) {
            for (var prop in source) {
                obj[prop] = source[prop];
            }
        }
    });
    return obj;
}

function parallel(tasks, callback) {
    var results = [], count = tasks.length;
    tasks.forEach(function (task, index) {
        task(function (err, data) {
            results[index] = data;
            if (err) {
                callback(err);
                callback = null;
            }
            if (--count === 0 && callback) {
                callback(null, results);
            }
        });
    });
}

function sure(obj, key, value) {
    var v = obj[key];
    return v ? v : obj[key] = (typeof value === 'function' ? value.call(obj) : value);
}

function makeId(prefix) {
    var i, possible, text;
    text = "";
    possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for (i = 0; i < 5; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return (prefix ? prefix : 'musher-') + text;
}

function parseAuthOptions(auth, opts) {
    if (auth) {
        if (auth.key) {
            opts.username = auth.key;
        }
        if (auth.secret) {
            opts.password = auth.secret;
        }
    }
}

function ensureSlashBefore(str) {
    if (!str) return str;
    return str[0] === '/' ? str : '/' + str;
}
},{}],9:[function(require,module,exports){

/**
 * This is the web browser implementation of `debug()`.
 *
 * Expose `debug()` as the module.
 */

exports = module.exports = require('./debug');
exports.log = log;
exports.formatArgs = formatArgs;
exports.save = save;
exports.load = load;
exports.useColors = useColors;
exports.storage = 'undefined' != typeof chrome
               && 'undefined' != typeof chrome.storage
                  ? chrome.storage.local
                  : localstorage();

/**
 * Colors.
 */

exports.colors = [
  'lightseagreen',
  'forestgreen',
  'goldenrod',
  'dodgerblue',
  'darkorchid',
  'crimson'
];

/**
 * Currently only WebKit-based Web Inspectors, Firefox >= v31,
 * and the Firebug extension (any Firefox version) are known
 * to support "%c" CSS customizations.
 *
 * TODO: add a `localStorage` variable to explicitly enable/disable colors
 */

function useColors() {
  // is webkit? http://stackoverflow.com/a/16459606/376773
  return ('WebkitAppearance' in document.documentElement.style) ||
    // is firebug? http://stackoverflow.com/a/398120/376773
    (window.console && (console.firebug || (console.exception && console.table))) ||
    // is firefox >= v31?
    // https://developer.mozilla.org/en-US/docs/Tools/Web_Console#Styling_messages
    (navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/) && parseInt(RegExp.$1, 10) >= 31);
}

/**
 * Map %j to `JSON.stringify()`, since no Web Inspectors do that by default.
 */

exports.formatters.j = function(v) {
  return JSON.stringify(v);
};


/**
 * Colorize log arguments if enabled.
 *
 * @api public
 */

function formatArgs() {
  var args = arguments;
  var useColors = this.useColors;

  args[0] = (useColors ? '%c' : '')
    + this.namespace
    + (useColors ? ' %c' : ' ')
    + args[0]
    + (useColors ? '%c ' : ' ')
    + '+' + exports.humanize(this.diff);

  if (!useColors) return args;

  var c = 'color: ' + this.color;
  args = [args[0], c, 'color: inherit'].concat(Array.prototype.slice.call(args, 1));

  // the final "%c" is somewhat tricky, because there could be other
  // arguments passed either before or after the %c, so we need to
  // figure out the correct index to insert the CSS into
  var index = 0;
  var lastC = 0;
  args[0].replace(/%[a-z%]/g, function(match) {
    if ('%%' === match) return;
    index++;
    if ('%c' === match) {
      // we only are interested in the *last* %c
      // (the user may have provided their own)
      lastC = index;
    }
  });

  args.splice(lastC, 0, c);
  return args;
}

/**
 * Invokes `console.log()` when available.
 * No-op when `console.log` is not a "function".
 *
 * @api public
 */

function log() {
  // this hackery is required for IE8/9, where
  // the `console.log` function doesn't have 'apply'
  return 'object' === typeof console
    && console.log
    && Function.prototype.apply.call(console.log, console, arguments);
}

/**
 * Save `namespaces`.
 *
 * @param {String} namespaces
 * @api private
 */

function save(namespaces) {
  try {
    if (null == namespaces) {
      exports.storage.removeItem('debug');
    } else {
      exports.storage.debug = namespaces;
    }
  } catch(e) {}
}

/**
 * Load `namespaces`.
 *
 * @return {String} returns the previously persisted debug modes
 * @api private
 */

function load() {
  var r;
  try {
    r = exports.storage.debug;
  } catch(e) {}
  return r;
}

/**
 * Enable namespaces listed in `localStorage.debug` initially.
 */

exports.enable(load());

/**
 * Localstorage attempts to return the localstorage.
 *
 * This is necessary because safari throws
 * when a user disables cookies/localstorage
 * and you attempt to access it.
 *
 * @return {LocalStorage}
 * @api private
 */

function localstorage(){
  try {
    return window.localStorage;
  } catch (e) {}
}

},{"./debug":10}],10:[function(require,module,exports){

/**
 * This is the common logic for both the Node.js and web browser
 * implementations of `debug()`.
 *
 * Expose `debug()` as the module.
 */

exports = module.exports = debug;
exports.coerce = coerce;
exports.disable = disable;
exports.enable = enable;
exports.enabled = enabled;
exports.humanize = require('ms');

/**
 * The currently active debug mode names, and names to skip.
 */

exports.names = [];
exports.skips = [];

/**
 * Map of special "%n" handling functions, for the debug "format" argument.
 *
 * Valid key names are a single, lowercased letter, i.e. "n".
 */

exports.formatters = {};

/**
 * Previously assigned color.
 */

var prevColor = 0;

/**
 * Previous log timestamp.
 */

var prevTime;

/**
 * Select a color.
 *
 * @return {Number}
 * @api private
 */

function selectColor() {
  return exports.colors[prevColor++ % exports.colors.length];
}

/**
 * Create a debugger with the given `namespace`.
 *
 * @param {String} namespace
 * @return {Function}
 * @api public
 */

function debug(namespace) {

  // define the `disabled` version
  function disabled() {
  }
  disabled.enabled = false;

  // define the `enabled` version
  function enabled() {

    var self = enabled;

    // set `diff` timestamp
    var curr = +new Date();
    var ms = curr - (prevTime || curr);
    self.diff = ms;
    self.prev = prevTime;
    self.curr = curr;
    prevTime = curr;

    // add the `color` if not set
    if (null == self.useColors) self.useColors = exports.useColors();
    if (null == self.color && self.useColors) self.color = selectColor();

    var args = Array.prototype.slice.call(arguments);

    args[0] = exports.coerce(args[0]);

    if ('string' !== typeof args[0]) {
      // anything else let's inspect with %o
      args = ['%o'].concat(args);
    }

    // apply any `formatters` transformations
    var index = 0;
    args[0] = args[0].replace(/%([a-z%])/g, function(match, format) {
      // if we encounter an escaped % then don't increase the array index
      if (match === '%%') return match;
      index++;
      var formatter = exports.formatters[format];
      if ('function' === typeof formatter) {
        var val = args[index];
        match = formatter.call(self, val);

        // now we need to remove `args[index]` since it's inlined in the `format`
        args.splice(index, 1);
        index--;
      }
      return match;
    });

    if ('function' === typeof exports.formatArgs) {
      args = exports.formatArgs.apply(self, args);
    }
    var logFn = enabled.log || exports.log || console.log.bind(console);
    logFn.apply(self, args);
  }
  enabled.enabled = true;

  var fn = exports.enabled(namespace) ? enabled : disabled;

  fn.namespace = namespace;

  return fn;
}

/**
 * Enables a debug mode by namespaces. This can include modes
 * separated by a colon and wildcards.
 *
 * @param {String} namespaces
 * @api public
 */

function enable(namespaces) {
  exports.save(namespaces);

  var split = (namespaces || '').split(/[\s,]+/);
  var len = split.length;

  for (var i = 0; i < len; i++) {
    if (!split[i]) continue; // ignore empty strings
    namespaces = split[i].replace(/\*/g, '.*?');
    if (namespaces[0] === '-') {
      exports.skips.push(new RegExp('^' + namespaces.substr(1) + '$'));
    } else {
      exports.names.push(new RegExp('^' + namespaces + '$'));
    }
  }
}

/**
 * Disable debug output.
 *
 * @api public
 */

function disable() {
  exports.enable('');
}

/**
 * Returns true if the given mode name is enabled, false otherwise.
 *
 * @param {String} name
 * @return {Boolean}
 * @api public
 */

function enabled(name) {
  var i, len;
  for (i = 0, len = exports.skips.length; i < len; i++) {
    if (exports.skips[i].test(name)) {
      return false;
    }
  }
  for (i = 0, len = exports.names.length; i < len; i++) {
    if (exports.names[i].test(name)) {
      return true;
    }
  }
  return false;
}

/**
 * Coerce `val`.
 *
 * @param {Mixed} val
 * @return {Mixed}
 * @api private
 */

function coerce(val) {
  if (val instanceof Error) return val.stack || val.message;
  return val;
}

},{"ms":11}],11:[function(require,module,exports){
/**
 * Helpers.
 */

var s = 1000;
var m = s * 60;
var h = m * 60;
var d = h * 24;
var y = d * 365.25;

/**
 * Parse or format the given `val`.
 *
 * Options:
 *
 *  - `long` verbose formatting [false]
 *
 * @param {String|Number} val
 * @param {Object} options
 * @return {String|Number}
 * @api public
 */

module.exports = function(val, options){
  options = options || {};
  if ('string' == typeof val) return parse(val);
  return options.long
    ? long(val)
    : short(val);
};

/**
 * Parse the given `str` and return milliseconds.
 *
 * @param {String} str
 * @return {Number}
 * @api private
 */

function parse(str) {
  str = '' + str;
  if (str.length > 10000) return;
  var match = /^((?:\d+)?\.?\d+) *(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|years?|yrs?|y)?$/i.exec(str);
  if (!match) return;
  var n = parseFloat(match[1]);
  var type = (match[2] || 'ms').toLowerCase();
  switch (type) {
    case 'years':
    case 'year':
    case 'yrs':
    case 'yr':
    case 'y':
      return n * y;
    case 'days':
    case 'day':
    case 'd':
      return n * d;
    case 'hours':
    case 'hour':
    case 'hrs':
    case 'hr':
    case 'h':
      return n * h;
    case 'minutes':
    case 'minute':
    case 'mins':
    case 'min':
    case 'm':
      return n * m;
    case 'seconds':
    case 'second':
    case 'secs':
    case 'sec':
    case 's':
      return n * s;
    case 'milliseconds':
    case 'millisecond':
    case 'msecs':
    case 'msec':
    case 'ms':
      return n;
  }
}

/**
 * Short format for `ms`.
 *
 * @param {Number} ms
 * @return {String}
 * @api private
 */

function short(ms) {
  if (ms >= d) return Math.round(ms / d) + 'd';
  if (ms >= h) return Math.round(ms / h) + 'h';
  if (ms >= m) return Math.round(ms / m) + 'm';
  if (ms >= s) return Math.round(ms / s) + 's';
  return ms + 'ms';
}

/**
 * Long format for `ms`.
 *
 * @param {Number} ms
 * @return {String}
 * @api private
 */

function long(ms) {
  return plural(ms, d, 'day')
    || plural(ms, h, 'hour')
    || plural(ms, m, 'minute')
    || plural(ms, s, 'second')
    || ms + ' ms';
}

/**
 * Pluralization helper.
 */

function plural(ms, n, name) {
  if (ms < n) return;
  if (ms < n * 1.5) return Math.floor(ms / n) + ' ' + name;
  return Math.ceil(ms / n) + ' ' + name + 's';
}

},{}],12:[function(require,module,exports){
// shim for using process in browser

var process = module.exports = {};
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = setTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            currentQueue[queueIndex].run();
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    clearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        setTimeout(drainQueue, 0);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

// TODO(shtylman)
process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],13:[function(require,module,exports){
/**
 * Merge object b with object a.
 *
 *     var a = { foo: 'bar' }
 *       , b = { bar: 'baz' };
 *
 *     merge(a, b);
 *     // => { foo: 'bar', bar: 'baz' }
 *
 * @param {Object} a
 * @param {Object} b
 * @return {Object}
 * @api public
 */

exports = module.exports = function(a, b){
  if (a && b) {
    for (var key in b) {
      a[key] = b[key];
    }
  }
  return a;
};

},{}]},{},[1])(1)
});