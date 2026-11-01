import { FactoryFormView } from './Controls/Base/factoryFormView.js';
import { FactoryControlInfoMapView } from "./Controls/controlInfoMapView.js";
import { CoreMapView } from "./Controls/Base/coreMapView.js";
import { FactoryMapView } from './Controls/Base/factoryMapView.js';
import { DemoWorld } from './demoWorld.js';
import { FactoryWorld } from './factoryWorld.js';
import { Cube } from './cube.js';
import { Entity } from './entity.js';
import { Room } from './room.js';
import { WorldMap } from './worldMap.js';
import { EntityMove } from './entityMove.js';
import { WorldLoop } from './worldLoop.js';

// Les types du moteur. Un type propre au jeu s'ajoute ici avec FactoryWorld.instance.register(Classe).
FactoryWorld.instance.register(Cube);
FactoryWorld.instance.register(Entity);
FactoryWorld.instance.register(Room);
FactoryWorld.instance.register(WorldMap);
FactoryWorld.instance.register(EntityMove);

function start(){
    const factoryForm = new FactoryFormView();
    const form = factoryForm.create(40, 40, 1760, 960);
    form.id = "formView";
    form.canMove = true;
    form.canResize = true;
    form.customTheme.background.color = "#5e5f5f";

    const factory = new FactoryMapView();
    const mapView = factory.create(550, 200, 1000, 500);
    mapView.id = "mapView";
    mapView.canMove = true;
    mapView.canResize = true;
    mapView.caseCount = 30;
    //mapView.canScale = true;
    form.add(mapView);

    // Le monde et son habillage. La vue ne sait rien d'autre que « voici une carte ».
    const demo = new DemoWorld();
    demo.textures();
    const worldMap = demo.createWorldMap();
    new WorldLoop(worldMap).start();
    mapView.worldMap = worldMap;
    mapView.floorsDefault = ["vide"];
    mapView.maxZ = demo.depth - 1;
    mapView.moveTo(0, 0, 0);

    // Le héros est sélectionné d'entrée : cliquer sur le sol l'y envoie,
    // cliquer sur un autre personnage change de sélection.
    mapView.select("heros");

    // Repères de mise au point, à réactiver au besoin.
    mapView.Draw.showGrid = false;
    mapView.Draw.showCaseNumbers = false;

    let controlInfoMapView = (new FactoryControlInfoMapView).create(10, 10, 425, 275);
    controlInfoMapView.id = "infoMapView";
    controlInfoMapView.canMove = true;
    controlInfoMapView.canResize = true;
    controlInfoMapView.mapView = mapView;
    form.add(controlInfoMapView);
}

if(document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', start);
else
    start();
