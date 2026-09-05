import { FactoryForm } from 'Control/form.js';
import { FactoryControlInfoIso } from "./Controls/controlinfoIso.js";
import { CoreIso } from "./coreIso.js";
import { FactoryMapView } from './Controls/factoryIso.js';
import { DemoWorld } from './demoIso.js';

window.onload = ()=>{
    const factoryform = new FactoryForm();
    const form = factoryform.create(100, 100, 1600, 800);
    form.id = "formMap";
    form.canMove = true;
    form.canResize = true;
    //form.customTheme.background.color = "#5e5f5fff";
    //form.customTheme.background.border.color = "#0515f0ff";

    const factory = new FactoryMapView();
    const mapView = factory.create(750, 100, 620, 320);
    mapView.canMove = true;
    mapView.canResize = true;
    //mapView.canScale = true;
    form.add(mapView);

    // Le monde et son habillage. La vue ne sait rien d'autre que « voici une carte ».
    const demo = new DemoWorld();
    demo.textures();
    mapView.map = demo.map();
    mapView.floorsDefault = ["vide"];
    mapView.maxZ = demo.depth - 1;
    mapView.moveTo(0, 0, 0);

    // Le héros est sélectionné d'entrée : cliquer sur le sol l'y envoie,
    // cliquer sur un autre personnage change de sélection.
    mapView.select("heros");

    // Repères de mise au point, à réactiver au besoin.
    mapView.Draw.showGrid = false;
    mapView.Draw.showNumbers = false;

    let controlInfoIso = (new FactoryControlInfoIso).create(10, 10, 425, 275);
    controlInfoIso.id = "infoIso";
    controlInfoIso.canMove = true;
    controlInfoIso.canResize = true;
    controlInfoIso.mapView = mapView;
    form.add(controlInfoIso);
};
