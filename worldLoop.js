/**
 * La boucle du monde : elle fait avancer une carte à intervalle régulier,
 * que quelque chose l'affiche ou non.
 *
 * Elle ne dépend ni de la vue ni du navigateur : le même code peut tourner
 * dans une page ou sur un serveur.
 *
 * interval : millisecondes entre deux ticks. Le sprite n'avance qu'à chaque
 * tick, donc la marche reste fluide tant que l'intervalle suit l'affichage.
 */
export class WorldLoop{

    #worldMap = null;
    #interval = 16;
    #timer = null;

    constructor(worldMap, interval = 16){
        this.#worldMap = worldMap;
        this.#interval = interval;
    }

    start(){
        if(this.#timer !== null) return;
        this.#timer = setInterval(() => this.#worldMap.tick(), this.#interval);
    }

    stop(){
        clearInterval(this.#timer);
        this.#timer = null;
    }
}
