import mqtt, { MqttClient } from "mqtt";
import { SensorSource } from "@biosync/shared";
import { ScoringService } from "./scoringService.js";

export class MqttIngestionService {
  private client: MqttClient | null = null;
  private isConnected: boolean = false;

  constructor(
    private brokerUrl: string = process.env.MQTT_BROKER_URL || "mqtt://localhost:1883",
    private topicPrefix: string = process.env.MQTT_TOPIC_PREFIX || "biosync",
    private scoringService: ScoringService,
    private getSelectedSource: () => SensorSource,
    private getAccumulatedMinutes: () => number,
    private onVitalsProcessed?: (vitals: any) => void
  ) {}

  public connect(): void {
    console.log(`Connecting to MQTT broker at ${this.brokerUrl}...`);

    try {
      this.client = mqtt.connect(this.brokerUrl, {
        reconnectPeriod: 5000,
        connectTimeout: 4000,
      });

      this.client.on("connect", () => {
        this.isConnected = true;
        console.log("MQTT client connected successfully to local broker!");
        const topic = `${this.topicPrefix}/+/vitals`;
        this.client?.subscribe(topic, (err) => {
          if (err) console.error("MQTT subscription error:", err);
          else console.log(`Subscribed to MQTT topic: ${topic}`);
        });
      });

      this.client.on("message", (topic, message) => {
        try {
          const rawString = message.toString();
          const rawPayload = JSON.parse(rawString);

          const activeSource = this.getSelectedSource();
          const accumulatedMins = this.getAccumulatedMinutes();

          // Pass current selectedSource and accumulatedMinutes into processSensorPayload
          const result = this.scoringService.processSensorPayload(
            rawPayload,
            accumulatedMins,
            activeSource
          );

          if (result.error) {
            console.warn(`[MQTT Reject] ${result.error}`);
          } else if (result.vitals && this.onVitalsProcessed) {
            this.onVitalsProcessed(result.vitals);
          }
        } catch (err: any) {
          console.warn("[MQTT Malformed JSON] Ignored message:", err.message);
        }
      });

      this.client.on("error", (err) => {
        this.isConnected = false;
        console.warn(`[MQTT Broker Warning] Cannot connect to ${this.brokerUrl} (${err.message}). System will continue with simulated telemetry.`);
      });

      this.client.on("offline", () => {
        this.isConnected = false;
      });
    } catch (err: any) {
      console.warn("MQTT setup error:", err.message);
    }
  }

  public getStatus(): { isConnected: boolean; brokerUrl: string } {
    return {
      isConnected: this.isConnected,
      brokerUrl: this.brokerUrl,
    };
  }
}
