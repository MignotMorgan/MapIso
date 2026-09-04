import { FactoryForm } from 'Control/form.js';
import { FactoryControlInfoIso } from "./Control/controlinfoIso.js";
import { CoreIso } from "./coreIso.js";
import { FactoryMapView } from './factoryIso.js';

window.onload = ()=>{
    const factoryform = new FactoryForm();
    const form = factoryform.create(100, 100, 1600, 800);
    form.id = "formMap";
    form.canMove = true;
    form.canResize = true;
    //form.canScale = true;
    //form.customTheme.background.color = "#5e5f5fff";
    //form.customTheme.background.border.color = "#0515f0ff";

    const factory = new FactoryMapView();
    const mapView = factory.create(750, 100, 620, 320);
    mapView.canMove = true;
    mapView.canResize = true;
    //mapView.canScale = true;
    //mapView.Border.left = 0;
    //mapView.Border.top = 0;
    //mapView.Border.right = 0;
    //mapView.Border.bottom = 0;
    form.add(mapView);

    let controlInfoIso = (new FactoryControlInfoIso).create(10, 10, 425, 275);
    controlInfoIso.id = "infoIso";
    controlInfoIso.canMove = true;
    controlInfoIso.canResize = true;
    controlInfoIso.mapView = mapView;
    form.add(controlInfoIso);
};
