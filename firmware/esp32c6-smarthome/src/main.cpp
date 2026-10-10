#include <Arduino.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <WebServer.h>
#include <Preferences.h>
#include <ArduinoJson.h>
#include <PZEM004Tv30.h>
#include "device_config.h"
#include "secrets.h"
#if ENABLE_RELAY_OUTPUT
#error "Main electricity meter must be read-only. Use a separate smart-switch firmware."
#endif

// Setup requires a USB cable/serial monitor to read the RANDOM setup AP password.
// PZEM is an AC mains device: use an electrician and an isolated UART interface.
Preferences prefs;
WebServer server(80);
HardwareSerial pzemUart(1);
PZEM004Tv30 pzem(pzemUart, PZEM_RX_GPIO, PZEM_TX_GPIO);
String wifiSsid, wifiPass, deviceId, deviceToken, pairingCode, enrollmentTicket;
String hardwareId, apPassword;
bool apRunning=false, isPaired=false;
bool portalRoutesRegistered=false;
unsigned long wifiLostAt=0,bootHoldAt=0;
bool bootActionDone=false;
unsigned long lastSync=0,lastReconnect=0,lastPairRenew=0;
struct Ack { String id; bool success; } ackQueue[5];
int ackCount=0;

String htmlEsc(const String &s) {
  String x=s;x.replace("&","&amp;");x.replace("<","&lt;");x.replace(">","&gt;");
  x.replace("\"","&quot;");x.replace("'","&#39;");return x;
}
String randomPass(int length) {
  const char *alpha="ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  String s;for(int i=0;i<length;i++)s+=alpha[esp_random()%strlen(alpha)];return s;
}
String setupPage(){
 String code=pairingCode.length()?htmlEsc(pairingCode):"กำลังรอการเชื่อม Wi-Fi และลงทะเบียนคลาวด์";
 const bool alreadyRegistered = deviceId.length() && deviceToken.length();
 String page=R"HTML(<!doctype html><html lang="th"><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta charset="utf-8"><title>Home Thames ตั้งค่าอุปกรณ์</title><style>
 *{box-sizing:border-box}body{font:15px system-ui,-apple-system,sans-serif;color:#1c365a;background:#f2f7ff;margin:0;padding:18px}
 main{max-width:430px;margin:30px auto;background:white;border:1px solid #e4edfa;box-shadow:0 12px 40px #193f7922;padding:24px;border-radius:20px}
 .logo{color:#2b76ed;font-size:22px;font-weight:850}.muted{color:#8297b3;font-size:12px;line-height:1.7}.status{background:#f1f6ff;border-radius:12px;padding:14px;margin:17px 0;font-size:12px}
 label{display:block;margin:15px 0 7px;font-size:12px;color:#6881a3;font-weight:700}input,select,button{font:inherit;width:100%;padding:13px;border-radius:11px;border:1px solid #dce7f7;background:white;color:#243e64}
 button{background:#327cf4;color:white;border:0;font-weight:750;cursor:pointer;margin-top:15px}.outline{background:white;color:#3375dd;border:1px solid #d8e5fa}.code{letter-spacing:2px;font-family:monospace;font-size:20px;font-weight:800;color:#2b72ee;overflow-wrap:anywhere;margin:9px 0 14px}
 small{color:#8ca0b8}hr{border:0;border-top:1px solid #eaf0fa;margin:24px 0}
 </style></head><body><main><div class="logo">⌂ Home Thames</div><p class="muted">บ้านอัจฉริยะ • ตั้งค่า Wi-Fi ผ่าน ESP32</p>
 <div class="status"><b>อุปกรณ์:</b> )HTML";
 page+=htmlEsc(hardwareId);
 page+=R"HTML(<br><b>สถานะ Wi-Fi:</b> )HTML";
 page+=WiFi.status()==WL_CONNECTED?"เชื่อมต่อแล้ว: "+htmlEsc(WiFi.SSID()):"ยังไม่เชื่อมต่อ";
 page+=R"HTML(</div><h3>1. เชื่อมต่อ Wi-Fi บ้าน</h3><p class="muted">เลือกเครือข่าย 2.4 GHz สำหรับสถานที่นี้ รหัสผ่าน Wi-Fi จะถูกเก็บไว้ในบอร์ด ไม่ส่งขึ้น Cloud</p>
 <button type="button" class="outline" onclick="scan()">สแกน Wi-Fi ใกล้เคียง</button>
 <div id="scanstatus" class="muted">กดสแกนเพื่อค้นหาเครือข่ายที่อยู่ใกล้</div>
 <form action="/save" method="post"><label for="ssid">ชื่อ Wi-Fi บ้าน (SSID)</label>
 <input id="ssid" name="ssid" maxlength="32" required placeholder="เลือกหรือพิมพ์ชื่อ Wi-Fi" list="networks" autocomplete="off"><datalist id="networks"></datalist>
 <label for="password">รหัสผ่าน Wi-Fi</label><input id="password" name="password" type="password" minlength="8" maxlength="63" required autocomplete="off" placeholder="รหัสผ่าน Wi-Fi บ้าน">)HTML";
 if (!alreadyRegistered) {
   page+=R"HTML(<label for="ticket">รหัสอนุญาตติดตั้งจาก Home Thames (48 ตัวอักษร)</label><input id="ticket" name="ticket" type="text" minlength="48" maxlength="48" required autocomplete="off" placeholder="คัดลอกจากเว็บ Home Thames">)HTML";
 } else {
   page+=R"HTML(<div class="status">✓ อุปกรณ์นี้จับคู่กับ Home Thames ไว้แล้ว เปลี่ยน Wi-Fi ได้ทันที <b>ไม่ต้องขอรหัสติดตั้งใหม่</b> และข้อมูลย้อนหลังจะยังอยู่</div>)HTML";
 }
 page+=R"HTML(<button>บันทึกและเชื่อมต่อ Wi-Fi</button></form>)HTML";
 if (!alreadyRegistered) {
  page+=R"HTML(<hr><h3>2. จับคู่กับ Home Thames</h3><p class="muted">หลังเชื่อมต่ออินเทอร์เน็ต บอร์ดจะแสดงรหัสจับคู่ชั่วคราว ให้นำไปใส่ในเว็บ Home Thames → เพิ่มอุปกรณ์</p><div class="code">)HTML";
  page+=code;
  page+=R"HTML(</div>)HTML";
 }
 page+=R"HTML(<button class="outline" onclick="location.reload()">รีเฟรชสถานะ</button><p class="muted">หลังต่อ Wi-Fi บ้านสำเร็จ AP ตั้งค่าจะปิดเอง หากย้ายที่และต้องเปลี่ยน Wi-Fi อีก ให้กดปุ่ม BOOT ค้าง 5 วินาทีขณะบอร์ดเปิดทำงาน หรือพิมพ์ WIFI_RESET ทาง USB</p></main>
 <script>async function scan(){const s=document.getElementById('scanstatus');s.textContent='กำลังสแกน…';try{const r=await fetch('/networks',{cache:'no-store'});if(!r.ok)throw Error('scan failed');const rows=await r.json(),list=document.getElementById('networks');list.replaceChildren();for(const x of rows){const o=document.createElement('option');o.value=x.ssid;o.label=x.ssid+' ('+x.rssi+' dBm)';list.append(o)}s.textContent=rows.length+' เครือข่ายที่พบ กดช่องชื่อ Wi-Fi เพื่อเลือกหรือพิมพ์เอง';}catch(e){s.textContent='สแกนไม่ได้ คุณยังพิมพ์ชื่อ Wi-Fi เองได้'}}</script>
 </body></html>)HTML";
 return page;
}
void setupPortal(){
 if(apRunning)return;
 // Stable random AP password: print it once and keep it on your device label.
 // The setup AP never uses a guessable default password.
 apPassword=prefs.getString("setup_key", "");
 if(apPassword.length()<12){apPassword=randomPass(14);prefs.putString("setup_key",apPassword);}
 String apName="HomeThames-Setup-"+hardwareId.substring(hardwareId.length()-4);
 WiFi.mode(WIFI_AP_STA);
 WiFi.softAP(apName.c_str(),apPassword.c_str());
 if (!portalRoutesRegistered) {
 server.on("/",HTTP_GET,[]{server.sendHeader("Cache-Control","no-store");server.send(200,"text/html; charset=utf-8",setupPage());});
 server.on("/networks",HTTP_GET,[]{
   int count=WiFi.scanNetworks(false,false);JsonDocument doc;JsonArray networks=doc.to<JsonArray>();
   if(count>0){for(int i=0;i<count&&i<40;i++){
     String ssid=WiFi.SSID(i);if(ssid.isEmpty())continue;
     JsonObject ap=networks.add<JsonObject>();ap["ssid"]=ssid;ap["rssi"]=WiFi.RSSI(i);ap["secure"]=WiFi.encryptionType(i)!=WIFI_AUTH_OPEN;
   }}
   WiFi.scanDelete();String json;serializeJson(doc,json);
   server.sendHeader("Cache-Control","no-store");server.send(200,"application/json; charset=utf-8",json);
 });
 server.on("/save",HTTP_POST,[]{
   const String ssid=server.arg("ssid"),pass=server.arg("password"),ticket=server.arg("ticket");
   if(ssid.length()<1||ssid.length()>32||pass.length()<8||pass.length()>63){server.send(400,"text/plain","ข้อมูล Wi-Fi ไม่ถูกต้อง");return;}
   // Cloud credentials are retained during Wi-Fi changes.
   // A one-time enrollment ticket is required ONLY before first registration.
   if(deviceId.isEmpty() || deviceToken.isEmpty()){
     if(ticket.length()!=48){server.send(400,"text/plain","กรุณากรอกรหัสอนุญาตติดตั้ง 48 ตัวอักษร");return;}
     for(size_t i=0;i<ticket.length();i++)if(!isxdigit(ticket[i])){server.send(400,"text/plain","รหัสอนุญาตไม่ถูกต้อง");return;}
     enrollmentTicket=ticket;enrollmentTicket.toUpperCase();
     prefs.putString("enroll_ticket",enrollmentTicket);
   }
   wifiSsid=ssid;wifiPass=pass;
   prefs.putString("ssid",wifiSsid);prefs.putString("password",wifiPass);
   server.send(200,"text/html; charset=utf-8","<meta name=viewport content=width=device-width,initial-scale=1><div style=font-family:system-ui;max-width:480px;margin:15vh auto;padding:25px><h2>บันทึก Wi-Fi ของ Home Thames แล้ว</h2><p>รอ 15–30 วินาที แล้วกลับไปที่ <a href='/'>หน้าตั้งค่าอุปกรณ์</a> เพื่อตรวจสถานะและรหัสจับคู่</p><p>ถ้าบอร์ดเชื่อมต่อไม่ได้ ให้ตรวจว่า Wi-Fi ที่เลือกเป็น 2.4 GHz</p></div>");
   WiFi.begin(wifiSsid.c_str(),wifiPass.c_str());
 });
 server.onNotFound([]{server.send(404,"text/plain","ไม่พบหน้าที่ขอ");});
 portalRoutesRegistered=true;
 }
 server.begin();apRunning=true;
 Serial.printf("\nSETUP AP: %s\nSETUP PASSWORD: %s\nOPEN: http://192.168.4.1\n",apName.c_str(),apPassword.c_str());
}
void stopPortal(){if(!apRunning)return;server.stop();WiFi.softAPdisconnect(true);apRunning=false;WiFi.mode(WIFI_STA);}

// Only remove the home Wi-Fi credentials. Device identity/token and pairing are preserved.
void resetWifiOnly(){
  Serial.println("WIFI RESET: preserving Home Thames device identity and pairing");
  prefs.remove("ssid");prefs.remove("password");
  wifiSsid="";wifiPass="";
  WiFi.disconnect(false,true);
  wifiLostAt=0;
  setupPortal();
}

// Detect BOOT GPIO9 while firmware is running (NOT during reboot/flash).
// Prevent a held button from repeatedly triggering resets.
void pollBootButton(){
  bool pressed=(digitalRead(WIFI_SETUP_BUTTON_GPIO)==LOW);
  if(!pressed){bootHoldAt=0;bootActionDone=false;return;}
  if(bootHoldAt==0)bootHoldAt=millis();
  if(!bootActionDone && millis()-bootHoldAt>=WIFI_BUTTON_HOLD_MS){
    bootActionDone=true;resetWifiOnly();
  }
}

bool cloudPost(const String& route, JsonDocument& input, JsonDocument& output, bool withToken){
  if(WiFi.status()!=WL_CONNECTED)return false;
  // Refuse to connect if certificate settings have not been provisioned.
  if(String(CLOUD_BASE_URL).indexOf("YOUR-PROJECT")>=0 || String(CLOUD_ROOT_CA).indexOf("REPLACE_WITH")>=0){
    Serial.println("Cloud URL / CA certificate must be configured in secrets.h");return false;
  }
  WiFiClientSecure client;client.setCACert(CLOUD_ROOT_CA);
  HTTPClient http;
  String url=String(CLOUD_BASE_URL)+"/functions/v1/"+route;
  if(!http.begin(client,url))return false;
  http.addHeader("Content-Type","application/json");
  if(withToken)http.addHeader("x-device-token",deviceToken);
  if(String(SUPABASE_PUBLISHABLE_KEY).length()>0)http.addHeader("apikey",SUPABASE_PUBLISHABLE_KEY);
  String payload;serializeJson(input,payload);
  int code=http.POST(payload);
  String response=code>0?http.getString():"";
  http.end();
  if(code<200||code>=300){Serial.printf("Cloud %s HTTP %d: %s\n",route.c_str(),code,response.substring(0,160).c_str());return false;}
  if(deserializeJson(output,response)!=DeserializationError::Ok){Serial.println("Bad JSON from Cloud");return false;}
  return true;
}
void registerDevice(){
 if(deviceId.length())return;
 if(enrollmentTicket.length()!=48){Serial.println("Need one-time setup ticket from Home Thames web");return;}
 JsonDocument req,reply;
 req["hardware_id"]=hardwareId;
 req["kind"]="energy_meter";
 req["enrollment_ticket"]=enrollmentTicket;
 if(!cloudPost("device-register",req,reply,false))return;
 deviceId=reply["device_id"].as<String>();
 deviceToken=reply["device_token"].as<String>();
 pairingCode=reply["pairing_code"].as<String>();
 if(!deviceId.length()||deviceToken.length()!=64||pairingCode.length()!=16){Serial.println("Enrollment response incomplete");return;}
 prefs.putString("dev_id",deviceId);prefs.putString("token",deviceToken);prefs.putString("pair_code",pairingCode);
 enrollmentTicket="";prefs.remove("enroll_ticket");
 Serial.printf("PAIR DEVICE ON Home Thames: %s\n",pairingCode.c_str());
}

// Makes the relay safe after reboot: OFF by default, never toggle on connection loss.
void setOutput(bool on){
 #if ENABLE_RELAY_OUTPUT
  digitalWrite(RELAY_GPIO, (on==bool(RELAY_ACTIVE_HIGH))?HIGH:LOW);
 #else
  (void)on;
 #endif
}
void renewPairing(){
 JsonDocument req,reply;req["device_id"]=deviceId;
 if(!cloudPost("device-renew",req,reply,true))return;
 String fresh=reply["pairing_code"].as<String>();
 if(fresh.length()==16){pairingCode=fresh;prefs.putString("pair_code",pairingCode);
    Serial.printf("NEW PAIR CODE: %s\n",pairingCode.c_str());}
}
void synchronize(){
 if(!deviceId.length()||!deviceToken.length()){registerDevice();return;}
 JsonDocument req,reply;
 req["device_id"]=deviceId;req["firmware_version"]=FIRMWARE_VERSION;
 #if ENABLE_RELAY_OUTPUT
  req["relay_state"]=(digitalRead(RELAY_GPIO)==(RELAY_ACTIVE_HIGH?HIGH:LOW));
 #endif
 JsonObject telemetry=req["telemetry"].to<JsonObject>();
 const float voltage=pzem.voltage(),current=pzem.current(),power=pzem.power();
 const float energy=pzem.energy(),hz=pzem.frequency(),pf=pzem.pf();
 if(isfinite(voltage)&&voltage>=0)telemetry["voltage_v"]=voltage;
 if(isfinite(current)&&current>=0)telemetry["current_a"]=current;
 if(isfinite(power)&&power>=0)telemetry["power_w"]=power;
 if(isfinite(energy)&&energy>=0)telemetry["energy_kwh"]=energy;
 if(isfinite(hz)&&hz>=0)telemetry["frequency_hz"]=hz;
 if(isfinite(pf)&&pf>=0)telemetry["power_factor"]=pf;
 JsonArray acks=req["acks"].to<JsonArray>();
 for(int i=0;i<ackCount;i++){
   JsonObject a=acks.add<JsonObject>();a["id"]=ackQueue[i].id;a["success"]=ackQueue[i].success;
 }
 if(!cloudPost("device-sync",req,reply,true))return;
 ackCount=0;isPaired=reply["paired"]|false;
 prefs.putBool("paired",isPaired);
 if(isPaired&&apRunning){stopPortal();Serial.println("Paired and setup AP closed");}
 if(!isPaired){
   if(lastPairRenew==0||millis()-lastPairRenew>25UL*60UL*1000UL){
     lastPairRenew=millis();renewPairing();
   }
   Serial.printf("Waiting for pairing: %s\n",pairingCode.c_str());return;
 }
 JsonArray commands=reply["commands"].as<JsonArray>();
 for(JsonObject cmd:commands){
   if(!cmd["id"].is<String>()||!cmd["desired_state"].is<bool>())continue;
   const bool next=cmd["desired_state"].as<bool>();
   bool success=false;
   #if ENABLE_RELAY_OUTPUT
    setOutput(next);success=true;
   #else
    Serial.println("Output rejected: firmware built as monitor only");
   #endif
   if(ackCount<5){ackQueue[ackCount++]={cmd["id"].as<String>(),success};}
 }
 Serial.printf("Cloud sync OK | %.0f W | %.3f kWh | %s\n",power,energy,isPaired?"PAIRED":"UNPAIRED");
}
void setup(){
 Serial.begin(115200);delay(700);
 prefs.begin("homethames",false);
 pinMode(WIFI_SETUP_BUTTON_GPIO,INPUT_PULLUP);
 hardwareId="ESP32C6-"+String((uint32_t)(ESP.getEfuseMac()>>24),HEX)+String((uint32_t)(ESP.getEfuseMac()&0xFFFFFF),HEX);
 hardwareId.toUpperCase();
 wifiSsid=prefs.getString("ssid","");wifiPass=prefs.getString("password","");
 deviceId=prefs.getString("dev_id","");deviceToken=prefs.getString("token","");
 pairingCode=prefs.getString("pair_code","");
 isPaired=prefs.getBool("paired",false);
 enrollmentTicket=prefs.getString("enroll_ticket","");
 #if ENABLE_RELAY_OUTPUT
  pinMode(RELAY_GPIO,OUTPUT);setOutput(false);
 #endif
 pzemUart.begin(9600,SERIAL_8N1,PZEM_RX_GPIO,PZEM_TX_GPIO);
 WiFi.mode(WIFI_STA);
 wifiLostAt=millis();
 if(wifiSsid.length())WiFi.begin(wifiSsid.c_str(),wifiPass.c_str());
 if(!wifiSsid.length() || !deviceId.length() || !isPaired)setupPortal();
 Serial.println("Home Thames ESP32-C6 firmware started");
}
void loop(){
 // Commands via USB: INFO, WIFI_SETUP, WIFI_RESET (keeps Cloud identity), RESET (factory).
 if(Serial.available()){
   String cmd=Serial.readStringUntil('\n');cmd.trim();
   if(cmd=="WIFI_RESET")resetWifiOnly();
   else if(cmd=="WIFI_SETUP")setupPortal();
   else if(cmd=="INFO"){
     Serial.printf("Home Thames ID: %s\nWi-Fi: %s\nPaired: %s\n",hardwareId.c_str(),wifiSsid.c_str(),isPaired?"yes":"no");
     Serial.printf("Setup AP name: HomeThames-Setup-%s\nSetup AP password: %s\n",hardwareId.substring(hardwareId.length()-4).c_str(),prefs.getString("setup_key", "(not created)").c_str());
   }
   else if(cmd=="RESET"){
     prefs.clear();Serial.println("FACTORY RESET: Wi-Fi and Cloud identity cleared; restarting");delay(400);ESP.restart();
   }
 }
 pollBootButton();
 if(apRunning)server.handleClient();
 if(WiFi.status()==WL_CONNECTED){wifiLostAt=0;}
 else if(wifiSsid.length()){
   if(wifiLostAt==0)wifiLostAt=millis();
   // If the old access point is unavailable for 90 s, open setup automatically.
   if(!apRunning && millis()-wifiLostAt>=WIFI_AUTO_SETUP_AFTER_MS)setupPortal();
 }
 if(WiFi.status()!=WL_CONNECTED&&wifiSsid.length()&&millis()-lastReconnect>RECONNECT_INTERVAL_MS){
  lastReconnect=millis();WiFi.begin(wifiSsid.c_str(),wifiPass.c_str());
 }
 if(WiFi.status()==WL_CONNECTED&&millis()-lastSync>=TELEMETRY_INTERVAL_MS){lastSync=millis();synchronize();}
 delay(10);
}
