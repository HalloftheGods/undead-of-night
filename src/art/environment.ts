// The world: ground tiles, street props, vehicles and buildings.
// A prop's anchor is the bottom centre of its PROP_DEFS footprint; art may rise above it.

import type { EnvironmentArt, PixelSprite } from './types.ts';
import { buildBrickApartment, buildSlabApartment } from './environment/apartment.ts';
import { buildCrates } from './containers/cartons.ts';
import { buildFridge, buildLocker } from './containers/shelving.ts';
import { buildCandyShop, buildForge, buildJukebox, buildLevelMap, buildPress } from './environment/bunker-props.ts';
import { buildClinic } from './environment/clinic.ts';
import { buildDiner } from './environment/diner.ts';
import { buildDiscount } from './environment/discount.ts';
import { buildFireworksBus } from './environment/fireworks-bus.ts';
import { buildRadioTower } from './environment/radio-tower.ts';
import { buildRadioStation } from './environment/radio-station.ts';
import { buildInterior } from './environment/floors.ts';
import { buildBed, buildCounter, buildShelf, buildSofa, buildTable, buildWorkbench } from './environment/furniture.ts';
import { buildGarage } from './environment/garage.ts';
import { buildGrocery } from './environment/grocery.ts';
import { buildGunShop } from './environment/gun-shop.ts';
import { buildCandyBowl } from './environment/halloween.ts';
import { buildHospital } from './environment/hospital.ts';
import { buildBungalow, buildFogCottage, buildGableHouse, buildHipHouse } from './environment/house.ts';
import { buildMerchantProps } from './environment/merchants.ts';
import { buildCactus, buildDeadTree, buildScrub } from './environment/desert.ts';
import { buildReeds, buildFungus } from './environment/blight.ts';
import { buildPine } from './environment/evergreen.ts';
import { buildBush, buildRubble, buildTree } from './environment/nature.ts';
import { buildBlastDoor, buildBlastDoorBuckling, buildBlastDoorBurst, buildChest, buildChestOpen } from './environment/overrun-props.ts';
import { buildManhole, buildSewerLadder } from './environment/sewer-props.ts';
import { buildPharmacy } from './environment/pharmacy.ts';
import { buildPolice } from './environment/police.ts';
import { buildSchool } from './environment/school.ts';
import {
  buildBarrelFire,
  buildBarrier,
  buildDumpster,
  buildFireBarrel,
  buildHydrant,
  buildSandbags,
  buildStreetLamp,
  buildStreetLampMirrored,
} from './environment/street.ts';
import { buildTiles } from './environment/tiles.ts';
import { buildHatchH, buildHatchV, buildPickupH } from './environment/car-bodies.ts';
import { CAR_PAINTS, LOT_PAINTS } from './environment/car-paints.ts';
import { buildAmbulance, buildAmbulanceLights, buildPoliceH, buildPoliceHLights, buildPoliceV, buildPoliceVLights } from './environment/emergency.ts';
import { buildEscapeVanLights, buildVan, VAN_LIVERIES } from './environment/van.ts';
import { buildSedanH, buildSedanV, buildWreckH } from './environment/vehicles.ts';
import { buildBrickWarehouse, buildSteelWarehouse } from './environment/warehouse.ts';
import { buildCampFenceDownH, buildCampFenceDownV, buildCampFenceH, buildCampFenceV, buildCampGate, buildCampPost, buildFenceRattle } from './environment/camp-fence.ts';
import { buildBedroll, buildCampTent, buildCampfire, buildCampfireFlames, buildLantern } from './environment/camp-props.ts';
import { buildCampMarket, buildCampQuarters, buildCampWorkshop } from './environment/camp-tents.ts';
import { buildFenceH, buildFenceV, buildGasPump } from './environment/yard.ts';

/** The sewers have no roof or walls to draw: the dark around them is the wall, so each piece is one clear pixel. */
function buildSewerShell(): PixelSprite {
  return { w: 1, h: 1, ax: 0, ay: 1, rgba: new Uint8ClampedArray(4) };
}

export function buildEnvironment(): EnvironmentArt {
  return {
    tiles: buildTiles(),
    props: {
      car_sedan_h: buildSedanH(),
      car_sedan_v: buildSedanV(),
      car_wreck_h: buildWreckH(),
      van_h: buildVan(),
      car_hatch_h: buildHatchH(),
      car_hatch_v: buildHatchV(),
      pickup_h: buildPickupH(),
      police_h: buildPoliceH(),
      police_v: buildPoliceV(),
      ambulance_h: buildAmbulance(),
      dumpster: buildDumpster(),
      crate_stack: buildCrates(),
      barrier: buildBarrier(),
      sandbags: buildSandbags(),
      tree: buildTree(),
      fire_barrel: buildFireBarrel(),
      street_lamp: buildStreetLamp(),
      street_lamp_r: buildStreetLampMirrored(),
      hydrant: buildHydrant(),
      pine: buildPine(),
      cactus: buildCactus(),
      dead_tree: buildDeadTree(),
      scrub: buildScrub(),
      reeds: buildReeds(),
      fungus: buildFungus(),
      bush: buildBush(),
      rubble: buildRubble(),
      fence_h: buildFenceH(),
      fence_v: buildFenceV(),
      camp_fence_h: buildCampFenceH(),
      camp_fence_v: buildCampFenceV(),
      camp_gate: buildCampGate(),
      camp_post: buildCampPost(),
      camp_fence_down_h: buildCampFenceDownH(),
      camp_fence_down_v: buildCampFenceDownV(),
      camp_tent: buildCampTent(),
      campfire: buildCampfire(),
      bedroll: buildBedroll(),
      lantern: buildLantern(),
      gas_pump: buildGasPump(),
      shelf: buildShelf(),
      counter: buildCounter(),
      table: buildTable(),
      sofa: buildSofa(),
      bed: buildBed(),
      locker: buildLocker(),
      fridge: buildFridge(),
      workbench: buildWorkbench(),
      candy_shop: buildCandyShop(),
      forge: buildForge(),
      level_map: buildLevelMap(),
      jukebox: buildJukebox(),
      press: buildPress(),
      ...buildMerchantProps(),
      blast_door: buildBlastDoor(),
      chest: buildChest(),
      candy_bowl: buildCandyBowl(),
      fireworks_bus: buildFireworksBus(),
      radio_tower: buildRadioTower(),
      manhole: buildManhole(),
      sewer_ladder: buildSewerLadder(),
    },
    paintJobs: {
      car_sedan_h: CAR_PAINTS.map(buildSedanH),
      car_sedan_v: LOT_PAINTS.map(buildSedanV),
      car_hatch_h: CAR_PAINTS.map(buildHatchH),
      car_hatch_v: CAR_PAINTS.map(buildHatchV),
      pickup_h: CAR_PAINTS.map(buildPickupH),
      van_h: VAN_LIVERIES.map(buildVan),
    },
    beacons: { police_h: buildPoliceHLights(), police_v: buildPoliceVLights(), ambulance_h: buildAmbulanceLights() },
    overrun: {
      doorBuckling: buildBlastDoorBuckling(),
      doorBurst: buildBlastDoorBurst(),
      chestOpen: buildChestOpen(),
      fenceRattleH: buildFenceRattle(buildCampFenceH(), 0x7a11),
      fenceRattleV: buildFenceRattle(buildCampFenceV(), 0x7a12),
    },
    buildings: {
      pharmacy: [buildPharmacy()],
      clinic: [buildClinic()],
      hospital: [buildHospital()],
      school: [buildSchool()],
      police: [buildPolice()],
      gun_shop: [buildGunShop()],
      grocery: [buildGrocery()],
      discount: [buildDiscount()],
      diner: [buildDiner()],
      garage: [buildGarage()],
      warehouse: [buildSteelWarehouse(), buildBrickWarehouse()],
      radio_station: [buildRadioStation()],
      house: [buildHipHouse(), buildGableHouse(), buildBungalow(), buildFogCottage()],
      camp_market: [buildCampMarket()],
      camp_workshop: [buildCampWorkshop()],
      camp_quarters: [buildCampQuarters()],
      apartment: [buildBrickApartment(), buildSlabApartment()],
      // Floors above and below are only ever seen from inside, so they borrow a house's shell.
      upstairs: [buildGableHouse()],
      cellar: [buildGableHouse()],
      apartment_upstairs: [buildBrickApartment()],
      hospital_upstairs: [buildHospital()],
      school_upstairs: [buildSchool()],
      // The sewers under the town: nothing to see from outside, so each is a single clear pixel.
      sewer_maze: [buildSewerShell()],
    },
    interior: buildInterior(),
    barrelFire: buildBarrelFire(),
    campFire: buildCampfireFlames(),
    escapeVan: buildVan(),
    escapeVanLights: buildEscapeVanLights(),
  };
}
