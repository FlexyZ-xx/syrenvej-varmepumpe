# Wiring Diagrams

## Single Relay Setup

### Components Needed
- ESP8266 (NodeMCU v1.0) or ESP32
- 5V Relay Module (with optocoupler)
- Micro USB cable (for power and programming)
- Jumper wires (3-4 pieces)

### Wiring Diagram - ESP8266 (NodeMCU)

```
┌─────────────────────────────────────────────────────────────┐
│                                                               │
│                    ESP8266 NodeMCU                            │
│                                                               │
│  [USB] ◄── Micro USB Cable (Power + Programming)             │
│                                                               │
│   ┌─────────────────────────────────────────────────┐        │
│   │                                                 │        │
│   │  3V3 ●                                    ● D0  │        │
│   │  GND ●────────────────┐                   ● D1  ├───┐    │
│   │   D1 ●                │                   ● D2  │   │    │
│   │   D2 ●                │                   ● D3  │   │    │
│   │   D3 ●                │                   ● D4  │   │    │
│   │   D4 ●                │                   ● GND │   │    │
│   │  GND ●                │                   ● 5V  │   │    │
│   │   5V ●                │                   ● 3V3 │   │    │
│   │                       │                         │   │    │
│   └───────────────────────┼─────────────────────────┘   │    │
│                           │                             │    │
└───────────────────────────┼─────────────────────────────┼────┘
                            │                             │
                            │                             │
                            │   ┌─────────────────────┐   │
                            │   │   Relay Module      │   │
                            │   │                     │   │
                            └───┤ GND                 │   │
                                │ VCC  ◄──────────────┼───┼─── 5V from NodeMCU
                                │ IN   ◄──────────────┘   │    or external 5V
                                │                         │
                                │  [NO] ●─────────────────┼─── To Heat Pump (Normally Open)
                                │  [COM]●─────────────────┼─── To Heat Pump Power
                                │  [NC] ●                 │    (Normally Closed - not used)
                                │                         │
                                └─────────────────────────┘
```

### Pin Connections Table

| ESP8266 Pin | Relay Module Pin | Description |
|-------------|------------------|-------------|
| GND         | GND              | Ground connection |
| 5V (VIN)    | VCC              | Power supply (5V) |
| D1 (GPIO5)  | IN               | Control signal |

### Wiring Diagram - ESP32

```
┌─────────────────────────────────────────────────────────────┐
│                                                               │
│                         ESP32                                 │
│                                                               │
│  [USB] ◄── Micro USB Cable (Power + Programming)             │
│                                                               │
│   ┌─────────────────────────────────────────────────┐        │
│   │                                                 │        │
│   │  3V3 ●                                    ● D2  │        │
│   │  GND ●────────────────┐                   ● D4  │        │
│   │   D5 ●────────────┐   │                   ● D5  │        │
│   │  D18 ●            │   │                   ● D18 │        │
│   │  D19 ●            │   │                   ● D19 │        │
│   │  GND ●            │   │                   ● GND │        │
│   │   5V ●            │   │                   ● 5V  │        │
│   │                   │   │                         │        │
│   └───────────────────┼───┼─────────────────────────┘        │
│                       │   │                                  │
└───────────────────────┼───┼──────────────────────────────────┘
                        │   │
                        │   │   ┌─────────────────────┐
                        │   │   │   Relay Module      │
                        │   │   │                     │
                        │   └───┤ GND                 │
                        └───────┤ VCC                 │
                                │ IN                  │
                                │                     │
                                │  [NO] ●             │
                                │  [COM]●             │
                                │  [NC] ●             │
                                └─────────────────────┘
```

**ESP32 Pin:** Use **GPIO5** (D5) for relay control

---

## Multi-Relay Setup (4 Relays)

For controlling multiple devices (heat pump, circulation pump, etc.)

### Components Needed
- ESP8266 or ESP32
- 4-Channel Relay Module
- Jumper wires (6 pieces)

### Wiring Diagram - 4 Channel Relay

```
┌─────────────────────────────────────────────────────────────┐
│                    ESP8266 NodeMCU                            │
│                                                               │
│   ┌─────────────────────────────────────────────────┐        │
│   │  GND ●────────────────┐                         │        │
│   │   5V ●────────────┐   │                         │        │
│   │   D1 ●───────┐    │   │                         │        │
│   │   D2 ●────┐  │    │   │                         │        │
│   │   D5 ●─┐  │  │    │   │                         │        │
│   │   D6 ●─┼──┼──┼──┐ │   │                         │        │
│   └────────┼──┼──┼──┼─┼───┼─────────────────────────┘        │
│            │  │  │  │ │   │                                  │
└────────────┼──┼──┼──┼─┼───┼──────────────────────────────────┘
             │  │  │  │ │   │
             │  │  │  │ │   │   ┌────────────────────────────┐
             │  │  │  │ │   │   │  4-Channel Relay Module    │
             │  │  │  │ │   │   │                            │
             │  │  │  │ │   └───┤ GND                        │
             │  │  │  │ └───────┤ VCC                        │
             │  │  │  └─────────┤ IN1  [Relay 1] ●───●───●   │
             │  │  └────────────┤ IN2  [Relay 2] ●───●───●   │
             │  └───────────────┤ IN3  [Relay 3] ●───●───●   │
             └──────────────────┤ IN4  [Relay 4] ●───●───●   │
                                │      [NO][COM][NC]          │
                                └────────────────────────────┘

Legend:
  NO  = Normally Open (connects when relay ON)
  COM = Common (always connected)
  NC  = Normally Closed (disconnects when relay ON)
```

### Multi-Relay Pin Connections

| ESP8266 Pin | Relay Module | Function |
|-------------|--------------|----------|
| GND         | GND          | Ground |
| 5V (VIN)    | VCC          | Power |
| D1 (GPIO5)  | IN1          | Heat Pump Relay |
| D2 (GPIO4)  | IN2          | Circulation Pump |
| D5 (GPIO14) | IN3          | Spare 1 |
| D6 (GPIO12) | IN4          | Spare 2 |

---

## Heat Pump Connection

**⚠️ WARNING: High Voltage! If you're not comfortable with electrical work, hire a licensed electrician.**

### Understanding Relay Contacts

```
When Relay is OFF:           When Relay is ON:
                            
  [NO]  ○                      [NO]  ●───────┐
  [COM] ●───── Connected       [COM] ●       │ Connected
  [NC]  ●───── to NC           [NC]  ○       └─────────

  NO  = Normally Open   (open when OFF, closed when ON)
  COM = Common          (always the connection point)
  NC  = Normally Closed (closed when OFF, open when ON)
```

### Safe Heat Pump Wiring

Most heat pumps have a low-voltage control circuit (24V AC) separate from the high voltage power. **Use this if available!**

```
Heat Pump Control Terminals:

  [R] ────●                    ● [Relay COM]
  [W] ────●────────────────────● [Relay NO]
  [C] ────●
  
  R = 24V AC hot
  W = Heating call
  C = Common
```

When relay closes, it connects R to W, calling for heat.

### Alternative: Power Interruption (High Voltage)

**Only if there's no low-voltage control option:**

```
Wall Outlet → [Relay COM]
               [Relay NO] → Heat Pump Power Plug
```

This interrupts the main power to the heat pump.

⚠️ **Safety Notes:**
- Use a relay rated for your heat pump's current (typically 10A or 15A)
- Ensure proper wire gauge (14 AWG for 15A circuits)
- Use strain relief and proper enclosures
- Consider adding a manual override switch
- Consult local electrical codes

---

## Power Supply Options

### Option 1: USB Power (Recommended for Testing)
```
Wall Adapter (5V 1A) → Micro USB → ESP8266
```
Simple and safe for development.

### Option 2: External 5V Supply
```
5V Power Supply → ESP8266 VIN + GND
                → Relay VCC + GND
```
Better for permanent installations with multiple relays.

### Option 3: Buck Converter from 12V
```
12V Supply → Buck Converter → 5V → ESP8266 + Relay
```
Useful if you have a 12V power source available.

---

## Enclosure Recommendations

### For Single Relay Setup
- Small project box: 100mm x 60mm x 25mm
- Ventilation holes for ESP8266 heat
- Cable glands for wires

### For Multi-Relay Setup
- Larger enclosure: 150mm x 100mm x 50mm
- Din rail mounting optional
- Label each relay channel

### Weatherproofing
If installing outdoors or in damp areas:
- IP65 rated enclosure
- Cable glands with rubber seals
- Silica gel packets inside to prevent moisture

---

## Testing Your Wiring

### Step 1: Visual Inspection
- ✓ Check all connections are secure
- ✓ Verify correct polarity (VCC, GND)
- ✓ Ensure no exposed wires

### Step 2: Multimeter Test (Power OFF)
- Set multimeter to continuity mode
- Check GND connections
- Verify no shorts between pins

### Step 3: Power On Test (No Load)
- Connect USB power only
- Check ESP8266 LED lights up
- Verify relay doesn't click (should be OFF by default)

### Step 4: Relay Test
- Upload Arduino sketch
- Use Serial Monitor to trigger relay
- Listen for "click" sound
- LED on relay module should light up

### Step 5: Load Test
- Connect a lamp or LED to relay (low voltage!)
- Test ON/OFF from web interface
- Verify smooth operation

---

## Troubleshooting

### Relay Doesn't Click
- Check VCC is connected to 5V (not 3.3V)
- Verify IN pin connection to correct GPIO
- Try active LOW relay (invert signal in code)

### ESP8266 Restarts When Relay Activates
- Power supply insufficient
- Use external power for relay
- Add capacitor (100µF) across VCC/GND

### Relay Clicks But Load Doesn't Switch
- Wrong relay contact (use NO, not NC)
- Wiring reversed on COM/NO
- Load exceeds relay rating

### WiFi Connection Drops
- Power supply voltage dropping
- Interference from relay switching
- Add ferrite bead on relay wires

---

## Advanced: Snubber Circuit

If you're switching inductive loads (motors, transformers), add a snubber circuit across the relay contacts to prevent arcing:

```
       ┌─── Resistor (100Ω, 2W) ───┐
[NO] ──┤                            ├── [COM]
       └─── Capacitor (0.1µF, 400V)─┘
```

This extends relay life significantly!

