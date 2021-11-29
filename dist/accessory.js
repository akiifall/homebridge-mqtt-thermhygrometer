"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
const homebridge_1 = require("homebridge");
let hap;
const mqtt_1 = __importDefault(require("mqtt"));
class ThermoHygrometer {
    constructor(log, config, api) {
        this.log = log;
        this.api = api;
        this.deviceName = config.name;
        this.manufacturer = config.manufacturer;
        this.model = config.model;
        this.serialNumber = config.serialNumber;
        this.mqttUrl = config.mqttUrl;
        this.mqttUser = config.mqttUser;
        this.mqttPass = config.mqttPass;
        this.topicStatus = config.topicStatus;
        this.temperature = 0;
        this.humidity = 0;
        this.informationService = new hap.Service.AccessoryInformation()
            .setCharacteristic(hap.Characteristic.Manufacturer, this.manufacturer)
            .setCharacteristic(hap.Characteristic.Model, this.model)
            .setCharacteristic(hap.Characteristic.SerialNumber, this.serialNumber);
        // Service Type
        this.deviceThermoService = new hap.Service.TemperatureSensor(this.deviceName);
        this.deviceThermoService.getCharacteristic(this.api.hap.Characteristic.CurrentTemperature)
            .on("get" /* GET */, this.getOnHandlerThermo.bind(this));
        this.deviceHumidityService = new hap.Service.HumiditySensor(this.deviceName);
        this.deviceHumidityService.getCharacteristic(this.api.hap.Characteristic.CurrentRelativeHumidity)
            .on("get" /* GET */, this.getOnHandlerHumidity.bind(this));
        this.mqttOptions = {
            keepalive: 10,
            clientId: this.deviceName + "_" + (Math.random() * 10000).toFixed(0),
            protocolId: 'MQTT',
            protocolVersion: 4,
            clean: true,
            reconnectPeriod: 1000,
            connectTimeout: 30 * 1000,
            will: {
                topic: 'home/will',
                payload: this.deviceName,
                qos: 0,
                retain: false
            },
            username: this.mqttUser,
            password: this.mqttPass,
            rejectUnauthorized: false
        };
        // connect to MQTT broker
        this.mqttClient = mqtt_1.default.connect(this.mqttUrl, this.mqttOptions);
        this.setMqttEvent();
        log.info(this.deviceName + " plugin loaded.");
    }
    getOnHandlerThermo(callback) {
        callback(null, this.temperature);
    }
    getOnHandlerHumidity(callback) {
        callback(null, this.humidity);
    }
    setMqttEvent() {
        this.mqttClient.on("message", (topic, message) => {
            if (topic === this.topicStatus) {
                let jsonData = JSON.parse(message.toString());
                if (!isNaN(jsonData.temp)) {
                    this.temperature = jsonData.temp;
                    this.deviceThermoService.getCharacteristic(homebridge_1.Characteristic.CurrentTemperature).updateValue(this.temperature, undefined, 'fromSetValue');
                    this.log.info("Temp : " + this.temperature);
                }
                if (!isNaN(jsonData.humidity)) {
                    this.humidity = jsonData.humidity;
                    this.deviceHumidityService.getCharacteristic(homebridge_1.Characteristic.CurrentRelativeHumidity).updateValue(this.humidity, undefined, 'fromSetValue');
                    this.log.info("Humidity : " + this.humidity);
                }
            }
        });
        this.mqttClient.on("connect", () => {
            this.mqttClient.subscribe(this.topicStatus, (error) => {
                if (error) {
                    this.log.info("Failed to subscribe : " + this.topicStatus);
                }
            });
        });
        this.mqttClient.on("close", () => {
            this.log.info("MQTT connection closed.");
        });
    }
    /*
     * This method is optional to implement. It is called when HomeKit ask to identify the accessory.
     * Typical this only ever happens at the pairing process.
     */
    identify() {
    }
    /*
     * This method is called directly after creation of this instance.
     * It should return all services which should be added to the accessory.
     */
    getServices() {
        return [
            this.informationService,
            this.deviceThermoService,
            this.deviceHumidityService
        ];
    }
}
module.exports = (api) => {
    hap = api.hap;
    api.registerAccessory("ThermoHygrometer", ThermoHygrometer);
};
//# sourceMappingURL=accessory.js.map