import { ControlInfo, FactoryControlInfo } from 'Control/Controls/controlinfo.js';

export class ControlInfoIso extends ControlInfo {
    #mapView;
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
        const control = this.control;
        
        if( this.mapView !== null){
            const inside = this.mapView.Mouse.inside();
            const c = this.mapView.case;
            const nbrCasesFrame = this.mapView.nbrCases;
            const sizeCase = this.mapView.sizeCase;
            const screen = this.mapView.screenFromCase(c.x, c.y);

            this.text += "\n"
            this.text += `Inside: ${inside.x}, ${inside.y} \n`;
            this.text += `Case: ${c.x}, ${c.y} \n`;
            this.text += `Adjustment: ${c.adjustment.x}%, ${c.adjustment.y}% \n`;
            this.text += `Nbr cases: ${nbrCasesFrame} \n`;
            this.text += `Total cases: ${this.mapView.cases.length} \n`;
            this.text += `Size case: ${sizeCase} \n`;
            this.text += `Screen: ${screen.x}, ${screen.y} \n`;
            
        }
    }
}

export class FactoryControlInfoIso extends FactoryControlInfo {
    createControl(){ return new ControlInfoIso(); }
}
