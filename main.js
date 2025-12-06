import { FactoryForm } from 'Control/form.js';
import { FactoryMapIso } from "./mapIso.js";
import { FactoryControlInfoIso } from "./Control/controlinfoIso.js";

window.onload = ()=>{
    const factoryform = new FactoryForm();
    const form = factoryform.create(100, 100, 1600, 800);
    form.id = "formMap";
    form.canMove = true;
    form.canResize = true;
    //form.canScale = true;
    //form.customTheme.background.color = "#5e5f5fff";
    //form.customTheme.background.border.color = "#0515f0ff";

    const factory = new FactoryMapIso();
    const mapIso = factory.create(750, 100, 620, 320);
    mapIso.canMove = true;
    mapIso.canResize = true;
    //mapIso.canScale = true;
    //mapIso.Border.left = 0;
    //mapIso.Border.top = 0;
    //mapIso.Border.right = 0;
    //mapIso.Border.bottom = 0;
    form.add(mapIso);

    let controlInfoIso = (new FactoryControlInfoIso).create(10, 10, 425, 275);
    controlInfoIso.id = "infoIso";
    controlInfoIso.canMove = true;
    controlInfoIso.canResize = true;
    controlInfoIso.mapIso = mapIso;
    form.add(controlInfoIso);
};