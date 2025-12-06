import { ControlInfo, FactoryControlInfo } from 'Control/Controls/controlinfo.js';

export class ControlInfoIso extends ControlInfo {
    #mapIso;
    constructor(){
        super();
    }
    get mapIso(){ return this.#mapIso; }
    set mapIso(value){ this.#mapIso = value; }
    
    initialize(){
        super.initialize();

    }

    tick(){
        super.tick();
        const control = this.control;
        
        if( this.mapIso !== null){
            const inside = this.mapIso.Mouse.inside();
            const c = this.mapIso.case;
            const nbrCasesFrame = this.mapIso.nbrCases;
            const sizeCase = this.mapIso.sizeCase;
            const screen = this.mapIso.screenFromCase(c.x, c.y);

            this.text += "\n"
            this.text += `Inside: ${inside.x}, ${inside.y} \n`;
            this.text += `Case: ${c.x}, ${c.y} \n`;
            this.text += `Adjustment: ${c.adjustment.x}%, ${c.adjustment.y}% \n`;
            this.text += `Nbr cases: ${nbrCasesFrame} \n`;
            this.text += `Size case: ${sizeCase} \n`;
            this.text += `Screen: ${screen.x}, ${screen.y} \n`;
            
        }
    }
}

export class FactoryControlInfoIso extends FactoryControlInfo {
    createControl(){ return new ControlInfoIso(); }
}