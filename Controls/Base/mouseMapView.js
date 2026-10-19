import { Core } from 'Control/core.js';
import { Mouse } from 'Control/input.js';
import { Point } from '../../point.js';

/** La souris sur la carte : survol, sélection, ordre de marche, zoom, pan. */
export class MouseMapView extends Mouse{

    #panFrom = new Point();

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

    /** Clic milieu : on saisit la carte. Le suivi caméra s'arrête. */
    clickMiddle(){
        const control = this.control;
        control.follow = false;
        const mouse = control.mouseFromScreen();
        this.#panFrom.set(mouse.x, mouse.y);
    }
    dragMiddle(){
        const control = this.control;
        const mouse = control.mouseFromScreen();
        control.pan(mouse.x - this.#panFrom.x, mouse.y - this.#panFrom.y);
        this.#panFrom.set(mouse.x, mouse.y);
    }

    wheel(deltaX, deltaY){
        const control = this.control;
        control.nbrCases = deltaY < 0 ? control.nbrCases -= 1 : control.nbrCases += 1;
    }
}
