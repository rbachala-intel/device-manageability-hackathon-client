var Protocol = require('azure-iot-device-mqtt').Mqtt;
var Client = require('azure-iot-device').Client;
var Message = require('azure-iot-device').Message;
var async = require('async');

require('dotenv').config()

var connectionString = process.env.VPRO_IOTHUB_CONNECTION_STRING;

console.log('iothub connection string', connectionString)

var temperature = 50;
var temperatureUnit = 'F';
var humidity = 50;
var humidityUnit = '%';
var pressure = 55;
var pressureUnit = 'psig';

var schema = "real-chiller;v1";
var deviceType = "RealChiller";
var deviceFirmware = "1.0.0";
var deviceFirmwareUpdateStatus = "";
var deviceLocation = "Building 44";
var deviceLatitude = 47.638928;
var deviceLongitude = -122.13476;
var deviceOnline = true;

var reportedProperties = {
  "SupportedMethods": "Reboot",
  "Telemetry": {
    [schema]: ""
  },
  "Type": deviceType,
  "Firmware": deviceFirmware,
  "FirmwareUpdateStatus": deviceFirmwareUpdateStatus,
  "Location": deviceLocation,
  "Latitude": deviceLatitude,
  "Longitude": deviceLongitude,
  "Online": deviceOnline
}

function printErrorFor(op) {
  return function printError(err) {
      if (err) console.log(op + ' error: ' + err.toString());
  };
}

function onDirectMethod(request, response) {
  // Implement logic asynchronously here.
  console.log('Simulated ' + request.methodName);

  // Complete the response
  response.send(200, request.methodName + ' was called on the device', function (err) {
    if (err) console.error('Error sending method response :\n' + err.toString());
    else console.log('200 Response to method \'' + request.methodName + '\' sent successfully.');
  });
}

// Simulated firmwareUpdate flow

function sendTelemetry(data, schema) {
  if (deviceOnline) {
    var d = new Date();
    var payload = JSON.stringify(data);
    var message = new Message(payload);
    message.properties.add('iothub-creation-time-utc', d.toISOString());
    message.properties.add('iothub-message-schema', schema);

    console.log('Sending device message data:\n' + payload);
    client.sendEvent(message, printErrorFor('send event'));
  } else {
    console.log('Offline, not sending telemetry');
  }
}

function generateRandomIncrement() {
  return ((Math.random() * 2) - 1);
}

var client = Client.fromConnectionString(connectionString, Protocol);

client.open(function (err) {
  if (err) {
    printErrorFor('open')(err);
  } else {
    // Create device Twin
    client.getTwin(function (err, twin) {
      if (err) {
        console.error('Could not get device twin');
      } else {
        console.log('Device twin created');
  
        twin.on('properties.desired', function (delta) {
          // Handle desired properties set by solution
          console.log('Received new desired properties:');
          console.log(JSON.stringify(delta));
        });
  
        // Send reported properties
        twin.properties.reported.update(reportedProperties, function (err) {
          if (err) throw err;
          console.log('Twin state reported');
        });
  
        // Register handlers for all the method names we are interested in.
        // Consider separate handlers for each method.
        client.onDeviceMethod('Reboot', onDirectMethod);
        // client.onDeviceMethod('FirmwareUpdate', onFirmwareUpdate);
        client.onDeviceMethod('EmergencyValveRelease', onDirectMethod);
        client.onDeviceMethod('IncreasePressure', onDirectMethod);
      }
    });
  
    // Start sending telemetry
    var sendDeviceTelemetry = setInterval(function () {
      temperature += generateRandomIncrement();
      pressure += generateRandomIncrement();
      humidity += generateRandomIncrement();
      var data = {
        'temperature': temperature,
        'temperature_unit': temperatureUnit,
        'humidity': humidity,
        'humidity_unit': humidityUnit,
        'pressure': pressure,
        'pressure_unit': pressureUnit
      };
      sendTelemetry(data, schema)
    }, 5000);
  
    client.on('error', function (err) {
      printErrorFor('client')(err);
      if (sendTemperatureInterval) clearInterval(sendTemperatureInterval);
      if (sendHumidityInterval) clearInterval(sendHumidityInterval);
      if (sendPressureInterval) clearInterval(sendPressureInterval);
      client.close(printErrorFor('client.close'));
    });
  }
  });
