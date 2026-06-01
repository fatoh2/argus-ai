import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AppController } from "./app.controller";
import { HealthModule } from "./health/health.module";
import * as yaml from "yaml";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [() => yaml.parse(require("fs").readFileSync("./config.yaml", "utf8"))],
    }),
    HealthModule,
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
