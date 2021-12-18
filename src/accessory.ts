import {
  AccessoryConfig,
  AccessoryPlugin,
  API,
  Characteristic,
  CharacteristicEventTypes,
  CharacteristicGetCallback,
  CharacteristicSetCallback,
  CharacteristicValue,
  HAP,
  Logging,
  Service
} from "homebridge";

let hap: HAP;

import mqtt, { MqttClient, IClientOptions } from "mqtt";
import { config } from "process";

/*
 * Initializer function called when the plugin is loaded.
 */
export = (api: API) => {
  hap = api.hap;
  api.registerAccessory("ThermoHygrometer", ThermoHygrometer);
};

class ThermoHygrometer implements AccessoryPlugin {
  private readonly log: Logging;
  private mqttOptions: IClientOptions;
  private mqttClient: MqttClient;
  private api: API;

  private deviceThermoService: Service;
  private deviceHumidityService: Service;
  private informationService: Service;

  private deviceName: string;
  private mqttUrl: string;
  private mqttUser: string;
  private mqttPass: string;
  private manufacturer: string;
  private model: string;
  private serialNumber: string;
  private topicStatus: string;

  private temperature: number;
  private humidity: number;

  constructor(log: Logging, config: AccessoryConfig, api: API) {
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
      .on(CharacteristicEventTypes.GET, this.getThermoHandler.bind(this));

    this.deviceHumidityService = new hap.Service.HumiditySensor(this.deviceName);
    this.deviceHumidityService.getCharacteristic(this.api.hap.Characteristic.CurrentRelativeHumidity)
      .on(CharacteristicEventTypes.GET, this.getHumidityHandler.bind(this));

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
    this.mqttClient = mqtt.connect(this.mqttUrl, this.mqttOptions);

    this.setMqttEvent();

    log.info(this.deviceName + " plugin loaded.");
  }

	getThermoHandler (callback: any) {
    callback(null, this.temperature);
	}

  getHumidityHandler (callback: any) {
    callback(null, this.humidity);
	}

  setMqttEvent() {
    this.mqttClient.on("message", (topic: string, message: Buffer) => {
      if (topic === this.topicStatus) {
        let jsonData: any = JSON.parse(message.toString());

        if (!isNaN(jsonData.temp)) {
          this.temperature = jsonData.temp;
          this.deviceThermoService.setCharacteristic(this.api.hap.Characteristic.CurrentTemperature, this.temperature);
          this.log.info("Temp : " + this.temperature);
        }

        if (!isNaN(jsonData.humidity)) {
          this.humidity = jsonData.humidity;
          this.deviceHumidityService.setCharacteristic(this.api.hap.Characteristic.CurrentRelativeHumidity, this.humidity);
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
  identify(): void {
  }

  /*
   * This method is called directly after creation of this instance.
   * It should return all services which should be added to the accessory.
   */
  getServices(): Service[] {
    return [
      this.informationService,
      this.deviceThermoService,
      this.deviceHumidityService
    ];
  }
}
