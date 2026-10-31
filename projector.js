import { Core } from 'Control/core.js';
import { Point, CasePoint } from './point.js';

/**
 * Le projecteur isométrique 2:1.
 *
 * Il convertit entre trois repères :
 *   monde (wx, wy, wz)  ↔  case caméra (cx, cy)  ↔  écran (sx, sy)
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
     * L'ajustement de panState décale le dessin sans bouger le contrôle.
     */
    origin(){
        const mapView = this.#mapView;
        const rect = mapView.Rectangle.rectangleBackground();
        const adjustment = mapView.panState.adjustment;
        return {
            x: rect.x + adjustment.x,
            y: rect.y + adjustment.y,
            width: rect.width,
            height: rect.height
        };
    }

    caseFromMouse(){
        const mouse = this.mouseFromScreen();
        return this.caseFromScreen(mouse.x, mouse.y);
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

    caseFromScreen(sx, sy){
        const sizeCase = this.#mapView.sizeCase;
        const origin = this.origin();
        const casePoint = new CasePoint();

        const percentX = ((sx - (origin.x + sizeCase)) / sizeCase) * 100;
        const percentY = ((sy - origin.y - (sizeCase / 2)) / sizeCase) * 100;
        const isoY = ((2 * percentY - percentX) / 2);
        const isoX = (percentX + isoY);

        casePoint.y = Math.round(isoY / 100);
        casePoint.x = Math.round(isoX / 100);
        casePoint.adjustment.x = Math.round(percentX - ((casePoint.x - casePoint.y) * 100));
        casePoint.adjustment.y = Math.round(percentY - ((casePoint.x + casePoint.y) * 50));
        return casePoint;
    }

    screenFromCase(cx, cy){
        const sizeCase = this.#mapView.sizeCase;
        const origin = this.origin();
        return new Point(((cx - cy) * sizeCase) + origin.x + sizeCase,
                         ((cx + cy) * sizeCase / 2) + origin.y);
    }

    /**
     * Monde → case caméra, avec la parallaxe d'altitude :
     * monter d'un cube recule d'une case en x et en y.
     */
    caseFromLocation(wx, wy, wz){
        const location = this.#mapView.location;
        return new CasePoint(
            Math.round(wx - location.x - (wz - location.z)),
            Math.round(wy - location.y - (wz - location.z))
        );
    }

    /**
     * Monde → écran. Même origine que screenFromCase : on passe par
     * caseFromLocation, pour n'avoir qu'une seule formule de losange.
     */
    screenFromLocation(wx, wy, wz){
        const casePoint = this.caseFromLocation(wx, wy, wz);
        const screen = this.screenFromCase(casePoint.x, casePoint.y);
        return new Point(parseInt(screen.x), parseInt(screen.y));
    }
}
