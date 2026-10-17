import { Core } from 'Control/core.js';
import { Point, CasePoint } from './point.js';

/**
 * Le projecteur isométrique 2:1.
 *
 * Il convertit entre trois repères :
 *   monde (x, y, z)  ↔  case caméra (cx, cy)  ↔  écran (px, py)
 *
 * Il ne décide de rien : il lit la taille d'une case, le cadrage du
 * contrôle et la position de la caméra, puis applique les formules.
 * Un seul endroit pour les mathématiques : plus personne ne les recopie.
 */
export class Projector{

    #mapView = null;

    constructor(mapView){
        this.#mapView = mapView;
    }

    get mapView(){ return this.#mapView; }

    /**
     * Origine et taille du losange visible, dans le repère du formulaire.
     * L'ajustement de revise décale le dessin sans bouger le contrôle.
     */
    redress(){
        const mapView = this.#mapView;
        const rect = mapView.Rectangle.rectangleBackground();
        const adjustment = mapView.revise.adjustment;
        return {
            x: rect.x + adjustment.x,
            y: rect.y + adjustment.y,
            width: rect.width,
            height: rect.height
        };
    }

    /**
     * Souris dans le repère de dessin : le même que case.screen et
     * entityDraw.screen. Mouse.inside() est relatif au contrôle, pas au
     * formulaire, et comparer les deux décale toute détection de clic.
     */
    mouseFromScreen(){
        const form = this.#mapView.form;
        return new Point(Core.mouse.x - form.Inside.x,
                         Core.mouse.y - form.Inside.y);
    }

    caseFromMouse(){
        const mouse = this.mouseFromScreen();
        return this.caseFromScreen(mouse.x, mouse.y);
    }

    caseFromScreen(x, y){
        const sizeCase = this.#mapView.sizeCase;
        const redressed = this.redress();
        const c = new CasePoint();

        x -= (redressed.x + sizeCase);
        y -= redressed.y;
        y -= (sizeCase / 2);

        x = ((x / sizeCase) * 100);
        y = ((y / sizeCase) * 100);

        const pY = ((2 * y - x) / 2);
        const pX = (x + pY);

        c.y = Math.round(pY / 100);
        c.x = Math.round(pX / 100);
        c.adjustment.x = Math.round(x - ((c.x - c.y) * 100));
        c.adjustment.y = Math.round(y - ((c.x + c.y) * 50));
        return c;
    }

    screenFromCase(x, y){
        const sizeCase = this.#mapView.sizeCase;
        const redressed = this.redress();
        return new Point(((x - y) * sizeCase) + redressed.x + sizeCase,
                         ((x + y) * sizeCase / 2) + redressed.y);
    }

    /**
     * Monde → case caméra, avec la parallaxe d'altitude :
     * monter d'un cube recule d'une case en x et en y.
     */
    caseFromLocation(x, y, z){
        const location = this.#mapView.location;
        return new CasePoint(
            x - location.x - (z - location.z),
            y - location.y - (z - location.z)
        );
    }

    /**
     * Monde → écran. Même origine que screenFromCase : on passe par
     * caseFromLocation, pour n'avoir qu'une seule formule de losange.
     */
    screenFromLocation(x, y, z){
        const c = this.caseFromLocation(x, y, z);
        const p = this.screenFromCase(c.x, c.y);
        return new Point(parseInt(p.x), parseInt(p.y));
    }
}
