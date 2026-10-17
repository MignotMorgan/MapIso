import { Core } from 'Control/core.js';
import { Mouse } from 'Control/input.js';

/** La souris sur la carte : survol, sélection, ordre de marche, zoom. */
export class MouseMapView extends Mouse{

    constructor(control){
        super(control);
    }

    hover(){
        super.hover();
        const control = this.control;
        if(Core.mousehover.control !== control)return;
        control.casePoint = control.caseFromMouse();
    }

    /**
     * Clic gauche : on désigne un personnage pour le sélectionner, on désigne
     * le sol pour l'y envoyer. C'est la boucle de jeu la plus courante d'un
     * moteur isométrique, et elle tient en quatre lignes.
     */
    clickLeft(){
        super.clickLeft();
        const control = this.control;
        control.casePoint = control.caseFromMouse();
        control.onTarget();

        if(control.target.id !== "") control.select(control.target.id);
        else control.moveSelectedTo(control.target.cube);
    }

    wheel(deltaX, deltaY){
        const control = this.control;
        control.nbrCases = deltaY < 0 ? control.nbrCases -= 1 : control.nbrCases += 1;
    }
}
