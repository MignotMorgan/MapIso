import { FactoryFormView } from './Controls/Base/factoryFormView.js';
import { FactoryControlInfoMapView } from "./Controls/controlInfoMapView.js";
import { CoreMapView } from "./Controls/Base/coreMapView.js";
import { FactoryMapView } from './Controls/Base/factoryMapView.js';
import { DemoWorld } from './demoWorld.js';

function start(){
    const factoryForm = new FactoryFormView();
    const form = factoryForm.create(100, 100, 1600, 800);
    form.id = "formView";
    form.canMove = true;
    form.canResize = true;
    form.customTheme.background.color = "#5e5f5f";

    const factory = new FactoryMapView();
    const mapView = factory.create(750, 100, 620, 320);
    mapView.id = "mapView";
    mapView.canMove = true;
    mapView.canResize = true;
    //mapView.canScale = true;
    form.add(mapView);

    // Le monde et son habillage. La vue ne sait rien d'autre que « voici une carte ».
    const demo = new DemoWorld();
    demo.textures();
    mapView.worldMap = demo.createWorldMap();
    mapView.floorsDefault = ["vide"];
    mapView.maxZ = demo.depth - 1;
    mapView.moveTo(0, 0, 0);

    // Le héros est sélectionné d'entrée : cliquer sur le sol l'y envoie,
    // cliquer sur un autre personnage change de sélection.
    mapView.select("heros");

    // Repères de mise au point, à réactiver au besoin.
    mapView.Draw.showGrid = true;
    mapView.Draw.showNumbers = true;

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
