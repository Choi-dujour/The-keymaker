// PI static dataset — generated from the official EVE Online SDE
// (planetSchematics.yaml + types.yaml). Do not edit by hand; regenerate with
// scripts/fetch-pi-data.mjs. EVE data © CCP hf., used under the CCP Developer License.
const PI_DATA = {
  planetTypes: {
 "temperate": {
  "name": "Temperate",
  "typeId": 11,
  "p0": [
   2268,
   2305,
   2288,
   2287,
   2073
  ]
 },
 "ice": {
  "name": "Ice",
  "typeId": 12,
  "p0": [
   2268,
   2272,
   2073,
   2310,
   2286
  ]
 },
 "gas": {
  "name": "Gas",
  "typeId": 13,
  "p0": [
   2268,
   2267,
   2309,
   2310,
   2311
  ]
 },
 "oceanic": {
  "name": "Oceanic",
  "typeId": 2014,
  "p0": [
   2268,
   2288,
   2287,
   2073,
   2286
  ]
 },
 "lava": {
  "name": "Lava",
  "typeId": 2015,
  "p0": [
   2267,
   2307,
   2272,
   2306,
   2308
  ]
 },
 "barren": {
  "name": "Barren",
  "typeId": 2016,
  "p0": [
   2268,
   2267,
   2288,
   2073,
   2270
  ]
 },
 "storm": {
  "name": "Storm",
  "typeId": 2017,
  "p0": [
   2268,
   2267,
   2309,
   2310,
   2308
  ]
 },
 "plasma": {
  "name": "Plasma",
  "typeId": 2063,
  "p0": [
   2267,
   2272,
   2270,
   2306,
   2308
  ]
 }
},
  commodities: {
 "44": {
  "name": "Enriched Uranium",
  "tier": 2,
  "volume": 0.75
 },
 "2073": {
  "name": "Microorganisms",
  "tier": 0,
  "volume": 0.005
 },
 "2267": {
  "name": "Base Metals",
  "tier": 0,
  "volume": 0.005
 },
 "2268": {
  "name": "Aqueous Liquids",
  "tier": 0,
  "volume": 0.005
 },
 "2270": {
  "name": "Noble Metals",
  "tier": 0,
  "volume": 0.005
 },
 "2272": {
  "name": "Heavy Metals",
  "tier": 0,
  "volume": 0.005
 },
 "2286": {
  "name": "Planktic Colonies",
  "tier": 0,
  "volume": 0.005
 },
 "2287": {
  "name": "Complex Organisms",
  "tier": 0,
  "volume": 0.005
 },
 "2288": {
  "name": "Carbon Compounds",
  "tier": 0,
  "volume": 0.005
 },
 "2305": {
  "name": "Autotrophs",
  "tier": 0,
  "volume": 0.005
 },
 "2306": {
  "name": "Non-CS Crystals",
  "tier": 0,
  "volume": 0.005
 },
 "2307": {
  "name": "Felsic Magma",
  "tier": 0,
  "volume": 0.005
 },
 "2308": {
  "name": "Suspended Plasma",
  "tier": 0,
  "volume": 0.005
 },
 "2309": {
  "name": "Ionic Solutions",
  "tier": 0,
  "volume": 0.005
 },
 "2310": {
  "name": "Noble Gas",
  "tier": 0,
  "volume": 0.005
 },
 "2311": {
  "name": "Reactive Gas",
  "tier": 0,
  "volume": 0.005
 },
 "2312": {
  "name": "Supertensile Plastics",
  "tier": 2,
  "volume": 0.75
 },
 "2317": {
  "name": "Oxides",
  "tier": 2,
  "volume": 0.75
 },
 "2319": {
  "name": "Test Cultures",
  "tier": 2,
  "volume": 0.75
 },
 "2321": {
  "name": "Polyaramids",
  "tier": 2,
  "volume": 0.75
 },
 "2327": {
  "name": "Microfiber Shielding",
  "tier": 2,
  "volume": 0.75
 },
 "2328": {
  "name": "Water-Cooled CPU",
  "tier": 2,
  "volume": 0.75
 },
 "2329": {
  "name": "Biocells",
  "tier": 2,
  "volume": 0.75
 },
 "2344": {
  "name": "Condensates",
  "tier": 3,
  "volume": 3
 },
 "2345": {
  "name": "Camera Drones",
  "tier": 3,
  "volume": 3
 },
 "2346": {
  "name": "Synthetic Synapses",
  "tier": 3,
  "volume": 3
 },
 "2348": {
  "name": "Gel-Matrix Biopaste",
  "tier": 3,
  "volume": 3
 },
 "2349": {
  "name": "Supercomputers",
  "tier": 3,
  "volume": 3
 },
 "2351": {
  "name": "Smartfab Units",
  "tier": 3,
  "volume": 3
 },
 "2352": {
  "name": "Nuclear Reactors",
  "tier": 3,
  "volume": 3
 },
 "2354": {
  "name": "Neocoms",
  "tier": 3,
  "volume": 3
 },
 "2358": {
  "name": "Biotech Research Reports",
  "tier": 3,
  "volume": 3
 },
 "2360": {
  "name": "Industrial Explosives",
  "tier": 3,
  "volume": 3
 },
 "2361": {
  "name": "Hermetic Membranes",
  "tier": 3,
  "volume": 3
 },
 "2366": {
  "name": "Hazmat Detection Systems",
  "tier": 3,
  "volume": 3
 },
 "2367": {
  "name": "Cryoprotectant Solution",
  "tier": 3,
  "volume": 3
 },
 "2389": {
  "name": "Plasmoids",
  "tier": 1,
  "volume": 0.19
 },
 "2390": {
  "name": "Electrolytes",
  "tier": 1,
  "volume": 0.19
 },
 "2392": {
  "name": "Oxidizing Compound",
  "tier": 1,
  "volume": 0.19
 },
 "2393": {
  "name": "Bacteria",
  "tier": 1,
  "volume": 0.19
 },
 "2395": {
  "name": "Proteins",
  "tier": 1,
  "volume": 0.19
 },
 "2396": {
  "name": "Biofuels",
  "tier": 1,
  "volume": 0.19
 },
 "2397": {
  "name": "Industrial Fibers",
  "tier": 1,
  "volume": 0.19
 },
 "2398": {
  "name": "Reactive Metals",
  "tier": 1,
  "volume": 0.19
 },
 "2399": {
  "name": "Precious Metals",
  "tier": 1,
  "volume": 0.19
 },
 "2400": {
  "name": "Toxic Metals",
  "tier": 1,
  "volume": 0.19
 },
 "2401": {
  "name": "Chiral Structures",
  "tier": 1,
  "volume": 0.19
 },
 "2463": {
  "name": "Nanites",
  "tier": 2,
  "volume": 0.75
 },
 "2867": {
  "name": "Broadcast Node",
  "tier": 4,
  "volume": 50
 },
 "2868": {
  "name": "Integrity Response Drones",
  "tier": 4,
  "volume": 50
 },
 "2869": {
  "name": "Nano-Factory",
  "tier": 4,
  "volume": 50
 },
 "2870": {
  "name": "Organic Mortar Applicators",
  "tier": 4,
  "volume": 50
 },
 "2871": {
  "name": "Recursive Computing Module",
  "tier": 4,
  "volume": 50
 },
 "2872": {
  "name": "Self-Harmonizing Power Core",
  "tier": 4,
  "volume": 50
 },
 "2875": {
  "name": "Sterile Conduits",
  "tier": 4,
  "volume": 50
 },
 "2876": {
  "name": "Wetware Mainframe",
  "tier": 4,
  "volume": 50
 },
 "3645": {
  "name": "Water",
  "tier": 1,
  "volume": 0.19
 },
 "3683": {
  "name": "Oxygen",
  "tier": 1,
  "volume": 0.19
 },
 "3689": {
  "name": "Mechanical Parts",
  "tier": 2,
  "volume": 0.75
 },
 "3691": {
  "name": "Synthetic Oil",
  "tier": 2,
  "volume": 0.75
 },
 "3693": {
  "name": "Fertilizer",
  "tier": 2,
  "volume": 0.75
 },
 "3695": {
  "name": "Polytextiles",
  "tier": 2,
  "volume": 0.75
 },
 "3697": {
  "name": "Silicate Glass",
  "tier": 2,
  "volume": 0.75
 },
 "3725": {
  "name": "Livestock",
  "tier": 2,
  "volume": 0.75
 },
 "3775": {
  "name": "Viral Agent",
  "tier": 2,
  "volume": 0.75
 },
 "3779": {
  "name": "Biomass",
  "tier": 1,
  "volume": 0.19
 },
 "3828": {
  "name": "Construction Blocks",
  "tier": 2,
  "volume": 0.75
 },
 "9828": {
  "name": "Silicon",
  "tier": 1,
  "volume": 0.19
 },
 "9830": {
  "name": "Rocket Fuel",
  "tier": 2,
  "volume": 0.75
 },
 "9832": {
  "name": "Coolant",
  "tier": 2,
  "volume": 0.75
 },
 "9834": {
  "name": "Guidance Systems",
  "tier": 3,
  "volume": 3
 },
 "9836": {
  "name": "Consumer Electronics",
  "tier": 2,
  "volume": 0.75
 },
 "9838": {
  "name": "Superconductors",
  "tier": 2,
  "volume": 0.75
 },
 "9840": {
  "name": "Transmitter",
  "tier": 2,
  "volume": 0.75
 },
 "9842": {
  "name": "Miniature Electronics",
  "tier": 2,
  "volume": 0.75
 },
 "9846": {
  "name": "Planetary Vehicles",
  "tier": 3,
  "volume": 3
 },
 "9848": {
  "name": "Robotics",
  "tier": 3,
  "volume": 3
 },
 "12836": {
  "name": "Transcranial Microcontrollers",
  "tier": 3,
  "volume": 3
 },
 "15317": {
  "name": "Genetically Enhanced Livestock",
  "tier": 2,
  "volume": 0.75
 },
 "17136": {
  "name": "Ukomi Superconductors",
  "tier": 3,
  "volume": 3
 },
 "17392": {
  "name": "Data Chips",
  "tier": 3,
  "volume": 3
 },
 "17898": {
  "name": "High-Tech Transmitters",
  "tier": 3,
  "volume": 3
 },
 "28974": {
  "name": "Vaccines",
  "tier": 3,
  "volume": 3
 }
},
  schematics: {
 "65": {
  "name": "Superconductors",
  "cycle": 3600,
  "output": 9838,
  "qty": 5,
  "inputs": [
   {
    "t": 2389,
    "q": 40
   },
   {
    "t": 3645,
    "q": 40
   }
  ]
 },
 "66": {
  "name": "Coolant",
  "cycle": 3600,
  "output": 9832,
  "qty": 5,
  "inputs": [
   {
    "t": 2390,
    "q": 40
   },
   {
    "t": 3645,
    "q": 40
   }
  ]
 },
 "67": {
  "name": "Rocket Fuel",
  "cycle": 3600,
  "output": 9830,
  "qty": 5,
  "inputs": [
   {
    "t": 2389,
    "q": 40
   },
   {
    "t": 2390,
    "q": 40
   }
  ]
 },
 "68": {
  "name": "Synthetic Oil",
  "cycle": 3600,
  "output": 3691,
  "qty": 5,
  "inputs": [
   {
    "t": 2390,
    "q": 40
   },
   {
    "t": 3683,
    "q": 40
   }
  ]
 },
 "69": {
  "name": "Oxides",
  "cycle": 3600,
  "output": 2317,
  "qty": 5,
  "inputs": [
   {
    "t": 2392,
    "q": 40
   },
   {
    "t": 3683,
    "q": 40
   }
  ]
 },
 "70": {
  "name": "Silicate Glass",
  "cycle": 3600,
  "output": 3697,
  "qty": 5,
  "inputs": [
   {
    "t": 2392,
    "q": 40
   },
   {
    "t": 9828,
    "q": 40
   }
  ]
 },
 "71": {
  "name": "Transmitter",
  "cycle": 3600,
  "output": 9840,
  "qty": 5,
  "inputs": [
   {
    "t": 2389,
    "q": 40
   },
   {
    "t": 2401,
    "q": 40
   }
  ]
 },
 "72": {
  "name": "Water-Cooled CPU",
  "cycle": 3600,
  "output": 2328,
  "qty": 5,
  "inputs": [
   {
    "t": 2398,
    "q": 40
   },
   {
    "t": 3645,
    "q": 40
   }
  ]
 },
 "73": {
  "name": "Mechanical Parts",
  "cycle": 3600,
  "output": 3689,
  "qty": 5,
  "inputs": [
   {
    "t": 2398,
    "q": 40
   },
   {
    "t": 2399,
    "q": 40
   }
  ]
 },
 "74": {
  "name": "Construction Blocks",
  "cycle": 3600,
  "output": 3828,
  "qty": 5,
  "inputs": [
   {
    "t": 2398,
    "q": 40
   },
   {
    "t": 2400,
    "q": 40
   }
  ]
 },
 "75": {
  "name": "Enriched Uranium",
  "cycle": 3600,
  "output": 44,
  "qty": 5,
  "inputs": [
   {
    "t": 2399,
    "q": 40
   },
   {
    "t": 2400,
    "q": 40
   }
  ]
 },
 "76": {
  "name": "Consumer Electronics",
  "cycle": 3600,
  "output": 9836,
  "qty": 5,
  "inputs": [
   {
    "t": 2400,
    "q": 40
   },
   {
    "t": 2401,
    "q": 40
   }
  ]
 },
 "77": {
  "name": "Miniature Electronics",
  "cycle": 3600,
  "output": 9842,
  "qty": 5,
  "inputs": [
   {
    "t": 2401,
    "q": 40
   },
   {
    "t": 9828,
    "q": 40
   }
  ]
 },
 "78": {
  "name": "Nanites",
  "cycle": 3600,
  "output": 2463,
  "qty": 5,
  "inputs": [
   {
    "t": 2393,
    "q": 40
   },
   {
    "t": 2398,
    "q": 40
   }
  ]
 },
 "79": {
  "name": "Biocells",
  "cycle": 3600,
  "output": 2329,
  "qty": 5,
  "inputs": [
   {
    "t": 2396,
    "q": 40
   },
   {
    "t": 2399,
    "q": 40
   }
  ]
 },
 "80": {
  "name": "Microfiber Shielding",
  "cycle": 3600,
  "output": 2327,
  "qty": 5,
  "inputs": [
   {
    "t": 2397,
    "q": 40
   },
   {
    "t": 9828,
    "q": 40
   }
  ]
 },
 "81": {
  "name": "Viral Agent",
  "cycle": 3600,
  "output": 3775,
  "qty": 5,
  "inputs": [
   {
    "t": 2393,
    "q": 40
   },
   {
    "t": 3779,
    "q": 40
   }
  ]
 },
 "82": {
  "name": "Fertilizer",
  "cycle": 3600,
  "output": 3693,
  "qty": 5,
  "inputs": [
   {
    "t": 2393,
    "q": 40
   },
   {
    "t": 2395,
    "q": 40
   }
  ]
 },
 "83": {
  "name": "Genetically Enhanced Livestock",
  "cycle": 3600,
  "output": 15317,
  "qty": 5,
  "inputs": [
   {
    "t": 2395,
    "q": 40
   },
   {
    "t": 3779,
    "q": 40
   }
  ]
 },
 "84": {
  "name": "Livestock",
  "cycle": 3600,
  "output": 3725,
  "qty": 5,
  "inputs": [
   {
    "t": 2395,
    "q": 40
   },
   {
    "t": 2396,
    "q": 40
   }
  ]
 },
 "85": {
  "name": "Polytextiles",
  "cycle": 3600,
  "output": 3695,
  "qty": 5,
  "inputs": [
   {
    "t": 2396,
    "q": 40
   },
   {
    "t": 2397,
    "q": 40
   }
  ]
 },
 "86": {
  "name": "Test Cultures",
  "cycle": 3600,
  "output": 2319,
  "qty": 5,
  "inputs": [
   {
    "t": 2393,
    "q": 40
   },
   {
    "t": 3645,
    "q": 40
   }
  ]
 },
 "87": {
  "name": "Supertensile Plastics",
  "cycle": 3600,
  "output": 2312,
  "qty": 5,
  "inputs": [
   {
    "t": 3683,
    "q": 40
   },
   {
    "t": 3779,
    "q": 40
   }
  ]
 },
 "88": {
  "name": "Polyaramids",
  "cycle": 3600,
  "output": 2321,
  "qty": 5,
  "inputs": [
   {
    "t": 2392,
    "q": 40
   },
   {
    "t": 2397,
    "q": 40
   }
  ]
 },
 "89": {
  "name": "Ukomi Superconductor",
  "cycle": 3600,
  "output": 17136,
  "qty": 3,
  "inputs": [
   {
    "t": 3691,
    "q": 10
   },
   {
    "t": 9838,
    "q": 10
   }
  ]
 },
 "90": {
  "name": "Condensates",
  "cycle": 3600,
  "output": 2344,
  "qty": 3,
  "inputs": [
   {
    "t": 2317,
    "q": 10
   },
   {
    "t": 9832,
    "q": 10
   }
  ]
 },
 "91": {
  "name": "Camera Drones",
  "cycle": 3600,
  "output": 2345,
  "qty": 3,
  "inputs": [
   {
    "t": 3697,
    "q": 10
   },
   {
    "t": 9830,
    "q": 10
   }
  ]
 },
 "92": {
  "name": "Synthetic Synapses",
  "cycle": 3600,
  "output": 2346,
  "qty": 3,
  "inputs": [
   {
    "t": 2312,
    "q": 10
   },
   {
    "t": 2319,
    "q": 10
   }
  ]
 },
 "94": {
  "name": "High-Tech Transmitter",
  "cycle": 3600,
  "output": 17898,
  "qty": 3,
  "inputs": [
   {
    "t": 2321,
    "q": 10
   },
   {
    "t": 9840,
    "q": 10
   }
  ]
 },
 "95": {
  "name": "Gel-Matrix Biopaste",
  "cycle": 3600,
  "output": 2348,
  "qty": 3,
  "inputs": [
   {
    "t": 2317,
    "q": 10
   },
   {
    "t": 2329,
    "q": 10
   },
   {
    "t": 9838,
    "q": 10
   }
  ]
 },
 "96": {
  "name": "Supercomputers",
  "cycle": 3600,
  "output": 2349,
  "qty": 3,
  "inputs": [
   {
    "t": 2328,
    "q": 10
   },
   {
    "t": 9832,
    "q": 10
   },
   {
    "t": 9836,
    "q": 10
   }
  ]
 },
 "97": {
  "name": "Robotics",
  "cycle": 3600,
  "output": 9848,
  "qty": 3,
  "inputs": [
   {
    "t": 3689,
    "q": 10
   },
   {
    "t": 9836,
    "q": 10
   }
  ]
 },
 "98": {
  "name": "Smartfab Units",
  "cycle": 3600,
  "output": 2351,
  "qty": 3,
  "inputs": [
   {
    "t": 3828,
    "q": 10
   },
   {
    "t": 9842,
    "q": 10
   }
  ]
 },
 "99": {
  "name": "Nuclear Reactors",
  "cycle": 3600,
  "output": 2352,
  "qty": 3,
  "inputs": [
   {
    "t": 44,
    "q": 10
   },
   {
    "t": 2327,
    "q": 10
   }
  ]
 },
 "100": {
  "name": "Guidance Systems",
  "cycle": 3600,
  "output": 9834,
  "qty": 3,
  "inputs": [
   {
    "t": 2328,
    "q": 10
   },
   {
    "t": 9840,
    "q": 10
   }
  ]
 },
 "102": {
  "name": "Neocoms",
  "cycle": 3600,
  "output": 2354,
  "qty": 3,
  "inputs": [
   {
    "t": 2329,
    "q": 10
   },
   {
    "t": 3697,
    "q": 10
   }
  ]
 },
 "103": {
  "name": "Planetary Vehicles",
  "cycle": 3600,
  "output": 9846,
  "qty": 3,
  "inputs": [
   {
    "t": 2312,
    "q": 10
   },
   {
    "t": 3689,
    "q": 10
   },
   {
    "t": 9842,
    "q": 10
   }
  ]
 },
 "104": {
  "name": "Biotech Research Reports",
  "cycle": 3600,
  "output": 2358,
  "qty": 3,
  "inputs": [
   {
    "t": 2463,
    "q": 10
   },
   {
    "t": 3725,
    "q": 10
   },
   {
    "t": 3828,
    "q": 10
   }
  ]
 },
 "105": {
  "name": "Vaccines",
  "cycle": 3600,
  "output": 28974,
  "qty": 3,
  "inputs": [
   {
    "t": 3725,
    "q": 10
   },
   {
    "t": 3775,
    "q": 10
   }
  ]
 },
 "106": {
  "name": "Industrial Explosives",
  "cycle": 3600,
  "output": 2360,
  "qty": 3,
  "inputs": [
   {
    "t": 3693,
    "q": 10
   },
   {
    "t": 3695,
    "q": 10
   }
  ]
 },
 "107": {
  "name": "Hermetic Membranes",
  "cycle": 3600,
  "output": 2361,
  "qty": 3,
  "inputs": [
   {
    "t": 2321,
    "q": 10
   },
   {
    "t": 15317,
    "q": 10
   }
  ]
 },
 "108": {
  "name": "Transcranial Microcontroller",
  "cycle": 3600,
  "output": 12836,
  "qty": 3,
  "inputs": [
   {
    "t": 2329,
    "q": 10
   },
   {
    "t": 2463,
    "q": 10
   }
  ]
 },
 "109": {
  "name": "Data Chips",
  "cycle": 3600,
  "output": 17392,
  "qty": 3,
  "inputs": [
   {
    "t": 2312,
    "q": 10
   },
   {
    "t": 2327,
    "q": 10
   }
  ]
 },
 "110": {
  "name": "Hazmat Detection Systems",
  "cycle": 3600,
  "output": 2366,
  "qty": 3,
  "inputs": [
   {
    "t": 3695,
    "q": 10
   },
   {
    "t": 3775,
    "q": 10
   },
   {
    "t": 9840,
    "q": 10
   }
  ]
 },
 "111": {
  "name": "Cryoprotectant Solution",
  "cycle": 3600,
  "output": 2367,
  "qty": 3,
  "inputs": [
   {
    "t": 2319,
    "q": 10
   },
   {
    "t": 3691,
    "q": 10
   },
   {
    "t": 3693,
    "q": 10
   }
  ]
 },
 "112": {
  "name": "Organic Mortar Applicators",
  "cycle": 3600,
  "output": 2870,
  "qty": 1,
  "inputs": [
   {
    "t": 2344,
    "q": 6
   },
   {
    "t": 2393,
    "q": 40
   },
   {
    "t": 9848,
    "q": 6
   }
  ]
 },
 "113": {
  "name": "Sterile Conduits",
  "cycle": 3600,
  "output": 2875,
  "qty": 1,
  "inputs": [
   {
    "t": 2351,
    "q": 6
   },
   {
    "t": 3645,
    "q": 40
   },
   {
    "t": 28974,
    "q": 6
   }
  ]
 },
 "114": {
  "name": "Nano-Factory",
  "cycle": 3600,
  "output": 2869,
  "qty": 1,
  "inputs": [
   {
    "t": 2360,
    "q": 6
   },
   {
    "t": 2398,
    "q": 40
   },
   {
    "t": 17136,
    "q": 6
   }
  ]
 },
 "115": {
  "name": "Self-Harmonizing Power Core",
  "cycle": 3600,
  "output": 2872,
  "qty": 1,
  "inputs": [
   {
    "t": 2345,
    "q": 6
   },
   {
    "t": 2352,
    "q": 6
   },
   {
    "t": 2361,
    "q": 6
   }
  ]
 },
 "116": {
  "name": "Recursive Computing Module",
  "cycle": 3600,
  "output": 2871,
  "qty": 1,
  "inputs": [
   {
    "t": 2346,
    "q": 6
   },
   {
    "t": 9834,
    "q": 6
   },
   {
    "t": 12836,
    "q": 6
   }
  ]
 },
 "117": {
  "name": "Broadcast Node",
  "cycle": 3600,
  "output": 2867,
  "qty": 1,
  "inputs": [
   {
    "t": 2354,
    "q": 6
   },
   {
    "t": 17392,
    "q": 6
   },
   {
    "t": 17898,
    "q": 6
   }
  ]
 },
 "118": {
  "name": "Integrity Response Drones",
  "cycle": 3600,
  "output": 2868,
  "qty": 1,
  "inputs": [
   {
    "t": 2348,
    "q": 6
   },
   {
    "t": 2366,
    "q": 6
   },
   {
    "t": 9846,
    "q": 6
   }
  ]
 },
 "119": {
  "name": "Wetware Mainframe",
  "cycle": 3600,
  "output": 2876,
  "qty": 1,
  "inputs": [
   {
    "t": 2349,
    "q": 6
   },
   {
    "t": 2358,
    "q": 6
   },
   {
    "t": 2367,
    "q": 6
   }
  ]
 },
 "121": {
  "name": "Water",
  "cycle": 1800,
  "output": 3645,
  "qty": 20,
  "inputs": [
   {
    "t": 2268,
    "q": 3000
   }
  ]
 },
 "122": {
  "name": "Plasmoids",
  "cycle": 1800,
  "output": 2389,
  "qty": 20,
  "inputs": [
   {
    "t": 2308,
    "q": 3000
   }
  ]
 },
 "123": {
  "name": "Electrolytes",
  "cycle": 1800,
  "output": 2390,
  "qty": 20,
  "inputs": [
   {
    "t": 2309,
    "q": 3000
   }
  ]
 },
 "124": {
  "name": "Oxygen",
  "cycle": 1800,
  "output": 3683,
  "qty": 20,
  "inputs": [
   {
    "t": 2310,
    "q": 3000
   }
  ]
 },
 "125": {
  "name": "Oxidizing Compound",
  "cycle": 1800,
  "output": 2392,
  "qty": 20,
  "inputs": [
   {
    "t": 2311,
    "q": 3000
   }
  ]
 },
 "126": {
  "name": "Reactive Metals",
  "cycle": 1800,
  "output": 2398,
  "qty": 20,
  "inputs": [
   {
    "t": 2267,
    "q": 3000
   }
  ]
 },
 "127": {
  "name": "Precious Metals",
  "cycle": 1800,
  "output": 2399,
  "qty": 20,
  "inputs": [
   {
    "t": 2270,
    "q": 3000
   }
  ]
 },
 "128": {
  "name": "Toxic Metals",
  "cycle": 1800,
  "output": 2400,
  "qty": 20,
  "inputs": [
   {
    "t": 2272,
    "q": 3000
   }
  ]
 },
 "129": {
  "name": "Chiral Structures",
  "cycle": 1800,
  "output": 2401,
  "qty": 20,
  "inputs": [
   {
    "t": 2306,
    "q": 3000
   }
  ]
 },
 "130": {
  "name": "Silicon",
  "cycle": 1800,
  "output": 9828,
  "qty": 20,
  "inputs": [
   {
    "t": 2307,
    "q": 3000
   }
  ]
 },
 "131": {
  "name": "Bacteria",
  "cycle": 1800,
  "output": 2393,
  "qty": 20,
  "inputs": [
   {
    "t": 2073,
    "q": 3000
   }
  ]
 },
 "132": {
  "name": "Biomass",
  "cycle": 1800,
  "output": 3779,
  "qty": 20,
  "inputs": [
   {
    "t": 2286,
    "q": 3000
   }
  ]
 },
 "133": {
  "name": "Proteins",
  "cycle": 1800,
  "output": 2395,
  "qty": 20,
  "inputs": [
   {
    "t": 2287,
    "q": 3000
   }
  ]
 },
 "134": {
  "name": "Biofuels",
  "cycle": 1800,
  "output": 2396,
  "qty": 20,
  "inputs": [
   {
    "t": 2288,
    "q": 3000
   }
  ]
 },
 "135": {
  "name": "Industrial Fibers",
  "cycle": 1800,
  "output": 2397,
  "qty": 20,
  "inputs": [
   {
    "t": 2305,
    "q": 3000
   }
  ]
 }
}
};
// typeId -> schematicId that produces it
PI_DATA.byOutput = {};
for (const [sid, s] of Object.entries(PI_DATA.schematics)) PI_DATA.byOutput[s.output] = Number(sid);
// planet type usable per schematic: a P1 schematic is "native" to a planet if its P0 is extractable there
PI_DATA.tierColor = { 0: '#8080a0', 1: '#39FF14', 2: '#4488ff', 3: '#ffcc33', 4: '#ff4455' };
