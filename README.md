# ResQ-Net

> See what fails next, before it happens.

ResQ-Net is a live map of how Bengaluru's power, water, hospitals and telecom depend on each other. When something breaks (a power cut, a flooded area, a pumping station that stops), ResQ-Net plays out hour by hour what fails next, alerts the people responsible before their facility fails, and shows how much damage acting early avoids.

**Team:** Error418  
**Event:** Build Beyond '26 (BMSCE)

---

## Problem Statement

City utilities such as hospitals, water pumping, emergency services and telecom usually run independently during disasters, so limited power gets used poorly and failures cascade. Build a decentralized system where an autonomous agent represents each utility. The agents negotiate in real time, through bids, priorities and concessions, over a fluctuating power supply. Every allocation must respect hard capacity limits, avoid inconsistent states, balance priority against fairness, and minimize total damage across a simulated multi-hour disaster scenario.

---

## Why ResQ-Net: Every Link Has Already Failed in Bengaluru

Every link in ResQ-Net's failure chain has already broken in real life. Each example below comes from a published report. Where a source is unclear, it says so.

### Key Facts and Figures

* A 20-minute power cut becomes about 4 hours without water. Pumps take nearly an hour to restart, then about 3 more hours to refill the city's reservoirs. By then at least 20% of Bengaluru's areas are affected, according to BWSSB officials.
* About 110 power disruptions hit BWSSB pumping stations in a single three-month summer stretch.
* In September 2022, one flooded pumping station cut water to more than 50 areas for two days.
* One substation fire blacked out nearly 90% of central Bengaluru localities, including Vidhana Soudha.
* During the 2024 water crisis, Apollo Bannerghatta was buying 40-50 water tankers a day after its borewells dried up.

---

### The Failure Chains

#### Flood to Water Pumping (September 2022)

* Bengaluru's Cauvery water travels about 100 km through three pumping stages: TK Halli, Harohalli and Tataguni. That's one chain with no bypass.
* The TK Halli pumping station flooded with all pumps under 40 feet of water. BWSSB's chairperson called it the first time a pumping station was totally flooded.
* 18 pumps and motors were damaged, costing about Rs 3 crore. Standby units were borrowed from the other two stages, and the station was restored in 36 hours against a 7-day estimate.
* The flood rose 1.5 m above the flood level the retaining walls were designed for, so the design assumption itself failed.
* Rainfall that season was 162% above average.

#### Flood to Power

* The Kadubeesanahalli power station flooded.
* BESCOM also deliberately cuts power to flooded apartment basements to prevent short circuits.
* So some outages are safety shutdowns, not damage. ResQ-Net treats both the same way: the supply is gone for a number of hours.

#### Power to Water

* **2019:** TK Halli had 14 power disruptions in about two months. Officials said a five-minute cut causes about a half-hour stoppage in pumping. A sudden stop also sends water surging backwards, which can burst pipes.
* **October 2024:** Lightning and rain damaged transformers feeding TK Halli and Harohalli, and both stations lost power at about 11 PM.
* **Undated incident:** An electrical failure at TK Halli and Tataguni stopped pumps for about 8.5 hours. It hit the stages supplying 140 and 320 million litres a day. Affected areas included Hebbal, RT Nagar, Rajajinagar, Yelahanka and Banaswadi.

#### Power to Hospitals

* **February 2023:** Bowring and Lady Curzon Hospital lost grid power for about 12 hours after a cable was cut. It ran on its generator, with diesel topped up twice. Some patients moved to Victoria and Vani Vilas hospitals. That diesel buffer is the countdown ResQ-Net shows on every hospital.
* **Substation fire:** The 220 kV substation fire meant load had to be rerouted to a substation at Victoria Hospital. That rerouting is the redundancy ResQ-Net measures.
* **September 2022 (Ballari, Karnataka):** Two ICU patients died during a power cut at VIMS. The opposition said backup power failed; the government disputed that, citing a 1.5-hour backup.

#### Water to Hospitals (2024 Crisis)

* Vydehi Hospital in Whitefield needs 8-10 lakh litres a day. BWSSB supply to its area had stopped, and its borewells were barely coping. Tanker prices rose from Rs 80 to Rs 120 per kilolitre in six months.
* Apollo Bannerghatta was spending Rs 30,000-35,000 a day on water.
* In March 2024, BWSSB cut Cauvery supply to bulk consumers, including hospitals, by up to 20%.

#### Power to Telecom to Hospitals

* NIMHANS and Sanjay Gandhi Institute of Trauma and Orthopaedics lost landlines for two days after power to a BSNL exchange was cut.
* Mobile coverage inside operating theatres and ICUs was poor, so staff used personal phones.
* The report places this in mid-July during the Covid period.

---

## Agency Dependencies

These chains cross agency boundaries: BESCOM and KPTCL (power), BWSSB (water), BSNL (telecom) and the hospitals themselves. BWSSB has had to publicly urge the power utilities for uninterrupted supply, and a senior Urban Development official had to chair a meeting to coordinate them. Nobody owns the whole chain. That is the gap ResQ-Net fills.

---

## What It Does

| Feature | Description |
| :--- | :--- |
| **Live City Map** | Street map with pins for every substation, water facility, hospital and telecom site |
| **Dependency Links** | Lines between facilities colored weak, medium, or strong based on supply lines and backup |
| **Report Incident** | Report power cuts, flooding, or water shortages; ResQ-Net computes cascade immediately |
| **Cascade Replay** | 72-hour timeline showing facilities changing status as failures spread |
| **Alerts & Response** | Actionable alerts for utility operators with failure deadlines and recommended actions |
| **Weak Links & Resilience** | Identifies highest-risk nodes and calculates total city resilience index |

---

## Run It (Windows, VS Code)

### Option 1: Quick Run (Pre-built App)

1. Double-click `run.bat` (or run `./run.sh` on Mac/Linux).
2. Open `http://localhost:8000` in your browser.

---

## Project Structure

```
README.md                 Main documentation file
requirements.txt          Python dependencies
run.bat / run.sh          Server startup scripts
data_pipeline/            OpenStreetMap data extraction scripts
data/                     Facility and road GeoJSON data
sim/                      Simulation engine and dependency graph builders
api/                      FastAPI backend endpoints
tools/                    Parity check and validation scripts
web/                      React frontend application
```

---

## Development Setup

```bash
cd web
npm install
npm run dev
npm run build
```

### Running Tests

```bash
python sim/test_engine.py
python tools/parity_expected.py
node tools/parity_check.mjs
```

---

## Data Parameters and Sources

| Parameter | Value | Source |
| :--- | :--- | :--- |
| **Pump Restart Time** | 1 hour | BWSSB Officials |
| **Reservoir Refill Time** | 3 hours | BWSSB Officials |
| **Reservoir Buffer Storage** | 1 hour | Calibrated against 20-min trip benchmark |
| **TK Halli Repair Duration** | 36 hours | Cauvery Supply Scheme Documentation |
| **Hospital Diesel Backup** | 12 hours | Default Baseline Estimate |
| **Hospital Water Storage** | 8 hours | Default Baseline Estimate |
| **Telecom Battery Backup** | 4 hours | Industry Standard Assumption |

---

## Limitations

* Real-world data gaps exist in OpenStreetMap tags for certain facilities.
* Facility interconnectivity is estimated based on geographic proximity where utility maps are private.
* Hospital backup durations serve as placeholders until site-specific confirmation is provided.
* All response alerts and actions are simulated within the application environment.
