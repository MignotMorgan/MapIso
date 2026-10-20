import { ControlInfo, FactoryControlInfo } from 'Control/Controls/controlinfo.js';

export class ControlInfoMapView extends ControlInfo {
    #mapView = null;
    constructor(){
        super();
    }
    get mapView(){ return this.#mapView; }
    set mapView(value){ this.#mapView = value; }

    initialize(){
        super.initialize();
    }

    tick(){
        super.tick();

        if(this.mapView !== null){
            const inside = this.mapView.Mouse.inside();
            const casePoint = this.mapView.casePoint;
            const caseCount = this.mapView.caseCount;
            const sizeCase = this.mapView.sizeCase;
            const screen = this.mapView.screenFromCase(casePoint.x, casePoint.y);

            this.text += "\n"
            this.text += `Inside: ${inside.x}, ${inside.y} \n`;
            this.text += `Case: ${casePoint.x}, ${casePoint.y} \n`;
            this.text += `Adjustment: ${casePoint.adjustment.x}%, ${casePoint.adjustment.y}% \n`;
            this.text += `Case count: ${caseCount} \n`;
            this.text += `Total cases: ${this.mapView.cases.length} \n`;
            this.text += `Size case: ${sizeCase} \n`;
            this.text += `Screen: ${screen.x}, ${screen.y} \n`;
        }
    }
}

export class FactoryControlInfoMapView extends FactoryControlInfo {
    createControl(){ return new ControlInfoMapView(); }
}
