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
        const mapview = this.control;
        if(Core.mousehover.control !== mapview)return;
        mapview.casePoint = mapview.caseFromMouse();
    }

    /**
     * Clic gauche : on désigne un personnage pour le sélectionner, on désigne
     * le sol pour l'y envoyer. C'est la boucle de jeu la plus courante d'un
     * moteur isométrique, et elle tient en quatre lignes.
     */
    clickLeft(){
        super.clickLeft();
        const mapview = this.control;
        mapview.casePoint = mapview.caseFromMouse();
        mapview.onTarget();

        if(mapview.target.id !== "") mapview.select(mapview.target.id);
        else mapview.moveSelectedTo(mapview.target.cube);
    }

    /** Clic milieu : on saisit la carte. Le suivi caméra s'arrête. */
    clickMiddle(){
        const mapview = this.control;
        mapview.following = false;
        const mouse = mapview.mouseFromScreen();
        this.#panFrom.set(mouse.x, mouse.y);
    }
    dragMiddle(){
        const mapview = this.control;
        const mouse = mapview.mouseFromScreen();
        mapview.pan(mouse.x - this.#panFrom.x, mouse.y - this.#panFrom.y);
        this.#panFrom.set(mouse.x, mouse.y);
    }

    wheel(deltaX, deltaY){
        const mapview = this.control;
        mapview.caseCount = deltaY < 0 ? mapview.caseCount -= 1 : mapview.caseCount += 1;
    }
}
