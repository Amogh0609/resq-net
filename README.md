# ResQ-Net

> See what fails next, before it happens.

ResQ-Net is a live map of how Bengaluru's power, water, hospitals and telecom depend on each other. When something breaks (a power cut, a flooded area, a pumping station that stops), ResQ-Net plays out hour by hour what fails next, alerts the people responsible before their facility fails, and shows how much damage acting early avoids.

**Team:** Error418  
**Event:** Build Beyond '26 (BMSCE)

---

## Problem Statement

City utilities such as hospitals, water pumping, emergency services and telecom usually run independently during disasters, so limited power gets used poorly and failures cascade. Build a decentralized system where an autonomous agent represents each utility. The agents negotiate in real time, through bids, priorities and concessions, over a fluctuating power supply. Every allocation must respect hard capacity limits, avoid inconsistent states, balance priority against fairness, and minimize total damage across a simulated multi-hour disaster scenario.

---

## Why ResQ-Net: Every link has already failed in Bengaluru

Every link in ResQ-Net's failure chain has already broken in real life. Each example below comes from a published report. Where a source is unclear, it says so.

### The Five Strongest Numbers

- A 20-minute power cut becomes about 4 hours without water. Pumps take nearly an hour to restart, then about 3 more hours to refill the city's reservoirs. By then at least 20% of Bengaluru's areas are affected, according to BWSSB officials.
- About 110 power disruptions hit BWSSB pumping stations in a single three-month summer stretch.
- In September 2022, one flooded pumping station cut water to more than 50 areas for two days.
- One substation fire blacked out nearly 90% of central Bengaluru localities, including Vidhana Soudha.
- During the 2024 water crisis, Apollo Bannerghatta was buying 40-50 water tankers a day after its borewells dried up.

---

### The Failure Chains, Link by Link

#### Flood -> Water Pumping (September 2022)
- Bengaluru's Cauvery water travels about 100 km through three pumping stages: TK Halli, Harohalli and Tataguni. That's one chain with no bypass.
- The TK Halli pumping station flooded with all pumps under 40 feet of water. BWSSB's chairperson called it the first time a pumping station was totally flooded.
- 18 pumps and motors were damaged, costing about Rs 3 crore. Standby units were borrowed from the other two stages, and the station was restored in 36 hours against a 7-day estimate.
- The flood rose 1.5 m above the flood level the retaining walls were designed for, so the design assumption itself failed.
- Rainfall that season was 162% above average.

#### Flood -> Power
- The Kadubeesanahalli power station flooded.
- BESCOM also deliberately cuts power to flooded apartment basements to prevent short circuits.
- So some outages are safety shutdowns, not damage. ResQ-Net treats both the same way: the supply is gone for a number of hours.

#### Power -> Water (This happens even without floods)
- **2019:** TK Halli had 14 power disruptions in about two months. Officials said a five-minute cut causes about a half-hour stoppage in pumping. A sudden stop also sends water surging backwards, which can burst pipes.
- **October 2024:** Lightning and rain damaged transformers feeding TK Halli and Harohalli, and both stations lost power at about 11 PM.
- **Undated incident** (the article gives no date): An electrical failure at TK Halli and Tataguni stopped pumps for about 8.5 hours. It hit the stages supplying 140 and 320 million litres a day. Affected areas included Hebbal, RT Nagar, Rajajinagar, Yelahanka and Banaswadi.

#### Power -> Hospitals
- **February 2023:** Bowring and Lady Curzon Hospital lost grid power for about 12 hours after a cable was cut. It ran on its generator, with diesel topped up twice. Some patients moved to Victoria and Vani Vilas hospitals. That diesel buffer is the countdown ResQ-Net shows on every hospital.
- **Substation fire:** The 220 kV substation fire meant load had to be rerouted to a substation at Victoria Hospital. That rerouting is the redundancy ResQ-Net measures (a strong link).
- **September 2022, Ballari (Karnataka):** Two ICU patients died during a power cut at VIMS. The opposition said backup power failed; the government disputed that, citing a 1.5-hour backup. The cause is disputed.

#### Water -> Hospitals (2024 Crisis)
- Vydehi Hospital in Whitefield needs 8-10 lakh litres a day. BWSSB supply to its area had stopped, and its borewells were barely coping. Tanker prices rose from Rs 80 to Rs 120 per kilolitre in six months.
- Apollo Bannerghatta was spending Rs 30,000-35,000 a day on water.
- In March 2024, BWSSB cut Cauvery supply to bulk consumers, including hospitals, by up to 20%.

#### Power -> Telecom -> Hospitals
- NIMHANS and Sanjay Gandhi Institute of Trauma and Orthopaedics lost landlines for two days after power to a BSNL exchange was cut.
- Mobile coverage inside operating theatres and ICUs was poor, so staff used personal phones.
- The report places this in mid-July during the Covid period. The year isn't stated directly.

---

### Nobody Owns the Whole Chain

These chains cross agency boundaries: BESCOM and KPTCL (power), BWSSB (water), BSNL (telecom) and the hospitals themselves. BWSSB has had to publicly urge the power utilities for uninterrupted supply, and a senior Urban Development official had to chair a meeting to coordinate them. Nobody owns the whole chain. That is the gap ResQ-Net fills.

#### Notes on the Evidence
- We found no public tool that maps these dependencies for Bengaluru. That isn't proof that none exists.
- We could not verify a typical hospital diesel-backup figure, so ResQ-Net uses a placeholder until a hospital confirms it.
- Two incidents above have no exact date in the source (the 8.5-hour TK Halli / Tataguni failure and the NIMHANS phone outage).

---

## Contents

- [Why ResQ-Net](#why-resq-net-every-link-has-already-failed-in-bengaluru)
- [What It Does](#what-it-does)
- [Run It (Windows, VS Code)](#run-it-windows-vs-code)
- [Two-Minute Demo](#two-minute-demo)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [Reading the Map](#reading-the-map)
- [Report an Incident](#report-an-incident)
- [Alerts and Response](#alerts-and-response)
- [The Three Pages](#the-three-pages)
- [Weak Links, Fix It and the Resilience Index](#weak-links-fix-it-and-the-resilience-index)
- [How It Works](#how-it-works)
- [Use the Real Bengaluru Data](#use-the-real-bengaluru-data)
- [Put It Online](#put-it-online)
- [Project Structure](#project-structure)
- [Where the Numbers Come From](#where-the-numbers-come-from)
- [Limits](#limits)

---

## What It Does

| Feature | What You See |
| :--- | :--- |
| **Live city map** | Street map (or dark map / satellite) with Google-style pins for every substation, water facility, hospital and telecom site |
| **Dependency links** | Lines between places, coloured weak / medium / strong by how many supply lines and how much backup each place has |
| **Report an incident** | Anyone reports a power cut, flooding or no water at a spot; ResQ-Net runs the cascade at once |
| **Cascade replay** | A 72-hour timeline: pins turn amber (on backup) and red (down) as the failure spreads |
| **Alerts** | Alerts for BESCOM, BWSSB, each hospital and telecom operators, with a deadline ("fails in 7 h") and a recommended action |
| **Response replays** | Send tankers, generators or repair crews, then replay to see hospitals saved and damage avoided |
| **Weak links & Fix it** | Ranks the highest-risk places and calculates the resilience index score |

---

## Run It (Windows, VS Code)

### Option 1: Quick run (pre-built app)
1. Double-click `run.bat` (or run `./run.sh` on Mac/Linux).
2. Open `http://localhost:8000` in your browser.

---

## Project Structure

```
README.md                 points back to this file
requirements.txt          Python packages (data pull + optional server)
run.bat / run.sh          start the optional FastAPI server
data_pipeline/
  fetch_osm.py            pull Bengaluru facilities and roads from OpenStreetMap
data/
  facilities.geojson, roads.geojson, cauvery_chain.csv, manifest.json    real OpenStreetMap pull
  sample/                 clearly labelled sample data (fallback only)
sim/
  params.json             every timing and buffer, with label, assumption flag and source
  build_graph.py          builds the dependency graph from the data
  engine.py               discrete-event cascade engine + recommender
  test_engine.py          engine tests (incl. BWSSB 20-min -> ~4 h check)
  sample_data.py          generates the sample data
api/
  export_static.py        packs graph + roads into web/dist/data/resq-net.json
  main.py                 optional FastAPI server
tools/
  parity_expected.py      Python reference results
  parity_check.mjs        checks the browser engine matches Python
  test_web.mjs            tests for link strength, reports, alerts and responses
  test_complaints.mjs     tests for complaint routing, priority and analysis
  test_feedback.mjs       tests for grades, suggestions and the report card
  test_voice.mjs          tests for voice words, spoken alerts and fallbacks
  test_contractors.mjs    tests for contractor names and reports to the control room
  test_auth.mjs           tests for accounts and what each role can open
web/
  dist/                   the built app: serve this folder
  public/                 manifest, service worker, icons, data/resq-net.json
  src/
    App.jsx               map, side panel, scenarios, playback
    engine.js             browser copy of the engine
    core.js / worker.js / api.js    run the engine in a Web Worker
    alerts.js             alerts and the response model
    main.jsx              the three pages, the top bar and who can open what
    AuthPage.jsx          log in and sign up
    auth.js               accounts and the three roles
    ComplaintsPage.jsx    citizen alerts, reports, department desk, analysis
    complaints.js         routing, alerts, priority score, duplicates, analysis
    feedback.js           grades, suggestions and the department report card
    workPhotos.js         credits for the example photos in web/public/photos
    contractors.js        citizens' contractor reports and the per-contractor summary
    voice.js              speech input and output, Kannada and Hindi alerts
    VoiceUI.jsx           microphone and read-aloud buttons
    HelpPage.jsx          phone numbers, questions, settings
    contacts.js           every authority number, with its source
    settings.js           this device's preferences
    complaintStore.js     saves complaints, photos and grades in the browser
    AlertsPanel.jsx       alerts panel
    AgencyReports.jsx     reports to BWSSB and KPTCL
    ReportCard.jsx        report-an-incident form
    PlaceUI.jsx           search, place card, photos, map controls
    mapkit.js             pins, link strength, photo helpers
    styles.css
```

---

## Edit the App (Needs Node 18+)

```bash
cd web
npm install
npm run dev        # http://localhost:5173
npm run build      # rebuilds web/dist
```

### Run the Tests

```bash
python sim/test_engine.py
python tools/parity_expected.py
node tools/parity_check.mjs
node --test tools/test_web.mjs tools/test_complaints.mjs tools/test_feedback.mjs tools/test_voice.mjs tools/test_contractors.mjs tools/test_auth.mjs
```

---

## Where the Numbers Come From

All values live in `sim/params.json`, each with its source.

| Parameter | Value | Source |
| :--- | :--- | :--- |
| **Pump restart after a power trip** | 1 h | BWSSB officials |
| **Reservoir refill after supply returns** | 3 h | BWSSB officials |
| **Reservoir storage without inflow** | 1 h | Calibrated so a 20-minute trip gives ~4.3 h of disruption, matching BWSSB's description |
| **TK Halli flood repair (Sept 2022)** | 36 h | Cauvery supply stages I-VBWSSB scheme |
| **Hospital diesel backup** | 12 h | Placeholder until the hospital calls |
| **Hospital water storage** | 8 h | Placeholder until the hospital calls |
| **Telecom battery** | 4 h | Assumption |
| **Dual power feed from 200+ beds** | Assumption | Default repair time 12 h |
| **Response times (tanker, generator, link, repair)** | 2 h, 3 h, 1 h, 4 h | Assumptions, shown on screen |

---

## Limits

- Real data has gaps. OpenStreetMap tags some clinics and pharmacies as hospitals, many water facilities have no name ("Water Tower"), and no hospital lists 200+ beds, so no hospital gets a second power feed and the map currently shows no strong links.
- Locations are real (OpenStreetMap). Links between facilities are estimated from location, because BESCOM and BWSSB don't publish feeder or pipe maps. With their data, the same tool becomes exact.
- Hospital backup hours are placeholders until confirmed with a hospital; the sliders show how results change.
- Alerts, reports and responses are simulated; nothing is sent to real people.
- Similar tools exist abroad (One Concern, InfraRisk). ResQ-Net is built for an Indian city, on Indian public data, around hospitals.
- A map of a city's weak points is sensitive. A real deployment would restrict access to authorised officials.
- Map data (c) OpenStreetMap contributors (ODbL). Basemap and imagery: Esri and its data providers (credited on screen). Photos: Wikimedia Commons (author and licence on each file page).
