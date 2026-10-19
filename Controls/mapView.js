import { CoreMapView } from './Base/coreMapView.js';
import { Control } from 'Control/control.js';
import { EntityDraw } from '../entityDraw.js';
import { Point, Location, CasePoint } from '../point.js';
import { Projector } from '../projector.js';
import { Selection } from '../selection.js';

export class MapView extends Control{
    //grab : Gestion du déplacement de la vue (saisir / déplacer)
     #grab = {x:0, y:0, adjustment: new Point(), border:25, step:25, modified:false, rolled:0};
    //wallCeil : Mode d'affichage des murs et plafonds
    #wallCeil = 0;

    // Carte voxel (cubes + joueurs + PNJ). Remplace l'ancien PageInfo.Map.
    #worldMap = null;
    //entities : PNJ / objets propres à cette vue (en plus de worldMap.entities)
    #entities = new Array();
    //entityDraws : Tableau optimisé des entités pour l'affichage
    #entityDraws = new Array();
    //playerDraws : vues écran des joueurs
    #playerDraws = [];
    //noCeilingZones : Tableau des zones sans plafond pour la visibilité
    #noCeilingZones = new Array();
    //resizeCases : Flag indiquant qu'il faut recalculer toutes les cases
    //#resizeCases = true;
    //createCase : Flag indiquant qu'il faut recréer le contenu des cases
    #createCase = false;
    //createCubes : Flag indiquant qu'il faut traiter de nouveaux cubes
    #createCubes = false;
    //rebuildEntityDraws : il faut recréer les EntityDraw (carte, zoom, sprites)
    #rebuildEntityDraws = true;

    //casePoint : case survolée sur la grille isométrique
    #casePoint = new CasePoint();
    /**
     * location : point du monde affiché au coin HAUT-GAUCHE de la vue.
     * Le champ de vision s'ouvre ensuite vers la droite et vers le bas, en
     * losange. Utiliser moveTo() pour la déplacer, afin que la vue se recalcule.
     */
    #location = new Location();
    #revise = {screen: new Point(), adjustment: new Point(), step:25, modified:false, rolled:0};
    #sizeCase = 0;
    #nbrCases= 10;
    #modified = false;
    //#colsCase;
    //#rowsCase;
    //cases : Tableau des cases 3D visibles à l'écran
    #cases = [];
    //maxZ : Niveau maximum d'affichage en profondeur (altitude)
    #maxZ = 10;
    //floorsDefault : textures dessinées sous les cases vides (repère de l'éditeur)
    #floorsDefault = [];
    //adjusted : si vrai, l'offset sous-case des entités décale leur sprite
    #adjusted = true;
    // Repères du dernier remplissage, pour ne recalculer les colonnes qu'en cas de changement.
    #drawn = {x:NaN, y:NaN, z:NaN, maxZ:-1, wallCeil:-1};
    // Dernière origine écran des cases : si le contrôle bouge, les sols doivent suivre.
    #placed = {x:NaN, y:NaN, sizeCase:0};
    #projector = null;
    #selection = null;

    constructor(){
        super();
        this.#projector = new Projector(this);
        this.#selection = new Selection(this);
    }

    initialize(){
        super.initialize();
        this.customTheme.background.color = "transparent";
        this.customTheme.background.rectangle.lineWidth = 0;
        this.modify();
    }
    /**
     * Un tour de boucle : on ne refait que ce qui a changé.
     * Les colonnes de cubes ne bougent que si la caméra ou la carte bouge ;
     * les entités, elles, sont replacées à chaque image puisqu'elles marchent.
     */
    tick(){
        super.tick();
        if(this.#modified)
            this.modify();

        if(this.viewChanged()) this.#createCubes = true;
        if(this.#createCubes){
            this.createCubes();
            this.#createCubes = false;
        }
        if(this.#rebuildEntityDraws){
            this.createEntityDraws();
            this.#rebuildEntityDraws = false;
        }
        if(this.#worldMap != null){
            const moved = this.#worldMap.tick();
            const selectedId = this.selected.id;
            if(selectedId !== "")
                for(let i = 0; i < moved.length; i++)
                    if(moved[i].id === selectedId){
                        this.noCeilingFromSelected();
                        break;
                    }
        }
        this.placeCases();
        this.placeEntityDraws();
    }
    /** La caméra ou le mode d'affichage ont-ils bougé depuis le dernier remplissage ? */
    viewChanged(){
        const drawn = this.#drawn;
        const location = this.#location;
        if(drawn.x === location.x && drawn.y === location.y && drawn.z === location.z
            && drawn.maxZ === this.#maxZ && drawn.wallCeil === this.#wallCeil) return false;
        drawn.x = location.x;
        drawn.y = location.y;
        drawn.z = location.z;
        drawn.maxZ = this.#maxZ;
        drawn.wallCeil = this.#wallCeil;
        return true;
    }
    /** Déplace la caméra. Le monde sous la vue est recalculé au prochain tour. */
    moveTo(x, y, z = this.#location.z){
        this.#location.set(x, y, z);
        this.#createCubes = true;
    }
    get casePoint(){ return this.#casePoint; }
    // On recopie dans le point existant : la vue garde le sien, personne ne
    // peut lui glisser un objet d'une autre forme à la place.
    set casePoint(value){ this.#casePoint.copy(value); }
    get location(){ return this.#location; }
    get projector(){ return this.#projector; }
    get selection(){ return this.#selection; }
    get revise(){ return this.#revise; }
    get sizeCase(){ return this.#sizeCase; }
    get nbrCases(){ return this.#nbrCases; }
    set nbrCases(value){ 
        value < 1 ? value = 1 : this.#nbrCases = value; 
        //this.#sizeCase = this.sizeCaseFrame(); 
        this.modified();
    }

    //set sizeCase(value){ this.#sizeCase = value; }
    //get colsCase(){ return this.#colsCase; }
    //get rowsCase(){ return this.#rowsCase; }
    get cases(){ return this.#cases; }
    set cases(value){ this.#cases = value; }
    get maxZ(){ return this.#maxZ; }
    set maxZ(value){ this.#maxZ = value; }
    get floorsDefault(){ return this.#floorsDefault; }
    set floorsDefault(value){ this.#floorsDefault = value || []; }
    get adjusted(){ return this.#adjusted; }
    set adjusted(value){ this.#adjusted = !!value; this.#rebuildEntityDraws = true; }


    get grab(){ return this.#grab; }
    get wallCeil(){ return this.#wallCeil; }
    set wallCeil(value){ this.#wallCeil = value ?? 0; }
    get selected(){ return this.#selection.selected; }
    get target(){ return this.#selection.target; }
    get selectedMulti(){ return this.#selection.selectedMulti; }
    get selectedMouse(){ return this.#selection.selectedMouse; }
    //get cases3D(){ return this.#cases3D; }
    get worldMap(){ return this.#worldMap; }
    /** Brancher une carte suffit : la vue se remplit toute seule au tour suivant. */
    set worldMap(value){
        this.#worldMap = value ?? null;
        this.#noCeilingZones = [];
        this.#createCubes = true;
        this.#rebuildEntityDraws = true;
    }
    get entities(){ return this.#entities; }
    get entityDraws(){ return this.#entityDraws; }
    get playerDraws(){ return this.#playerDraws; }
    get noCeilingZones(){ return this.#noCeilingZones; }
    //get resizeCases(){ return this.#resizeCases; }
    get createCase(){ return this.#createCase; }
    get createCubes(){ return this.#createCubes; }
    get rebuildEntityDraws(){ return this.#rebuildEntityDraws; }

    modified(){ this.#modified = true; }
    modify(){
        this.#sizeCase = this.sizeCaseFrame();
        this.createCases();
        this.#modified = false;
        this.#createCubes = true;
        this.#rebuildEntityDraws = true;   // la taille des sprites dépend de sizeCase
    }

    newCase(x, y ){
        const c = CoreMapView.FactoryWorld.createCase(x, y);
        c.screen = this.screenFromCase(x, y );
        return c;
    }
    nbrCasesFrame(){
        const sizeCase = this.sizeCase;
        const redressed = this.redress();
        const width = redressed.width;
        return Math.round(width/sizeCase/2);
    }
    sizeCaseFrame(){
        const sizeCase = this.sizeCase;
        const redressed = this.redress();
        const width = redressed.width;
        return (width/this.nbrCases)/2;
    }
    redress(){ return this.#projector.redress(); }
    mouseFromScreen(){ return this.#projector.mouseFromScreen(); }
    caseFromMouse(){ return this.#projector.caseFromMouse(); }
    caseFromScreen(x, y){ return this.#projector.caseFromScreen(x, y); }
    screenFromCase(x, y){ return this.#projector.screenFromCase(x, y); }
    caseFromLocation(x, y, z){ return this.#projector.caseFromLocation(x, y, z); }
    screenFromLocation(x, y, z){ return this.#projector.screenFromLocation(x, y, z); }
    createCases(){
        const maxCases = this.nbrCases*2;
        this.cases = [];
        for(let x = 0-maxCases; x <= maxCases; x++){
            for(let y = 0-maxCases; y <= maxCases; y++){
                const abs = Math.abs(x)+Math.abs(y);
                if(x - y >= -2 && x + y >= -2 && abs <= maxCases){
                    const c = this.newCase(x, y);
                    this.cases.push(c);
                }
            }
        }
        this.#placed.x = NaN;
        this.#placed.y = NaN;
    }

    /**
     * Recale chaque case sur le rectangle actuel du contrôle.
     * createCases ne le fait qu'une fois : un déplacement de MapView
     * change redress() sans recréer la grille, donc les sols resteraient
     * collés à l'ancienne origine alors que les entités, replacées
     * chaque image, suivraient le contrôle.
     */
    placeCases(){
        const redressed = this.redress();
        const placed = this.#placed;
        if(placed.x === redressed.x && placed.y === redressed.y && placed.sizeCase === this.#sizeCase)
            return;
        placed.x = redressed.x;
        placed.y = redressed.y;
        placed.sizeCase = this.#sizeCase;

        for(let i = 0; i < this.#cases.length; i++){
            const c = this.#cases[i];
            c.screen = this.screenFromCase(c.x, c.y);
        }
    }


    
    /**
     * Remplit chaque case visible avec la colonne de cubes monde.
     * px/py : origine caméra + offset case, moins z caméra (parallaxe).
     * À z croissant on ajoute z à x et y : un étage « recule » en iso.
     */
    createCubes()
    {
        if(this.worldMap == null)return;
        for(let i = 0; i < this.cases.length; i++)
        {
            const C2D = this.cases[i];
            C2D.cubes = [];
            const px = this.location.x + C2D.x - this.location.z;
            const py = this.location.y + C2D.y - this.location.z;
            let c;

            for (let z = 0; z <= this.maxZ; z++)
            {
                c = this.findCube(px + z, py + z, z);
                if(c != null && !this.containsNoCeiling(c.x, c.y, c.z))
                        C2D.cubes[C2D.cubes.length] = c;
            }

        }
    }

    /** PNJ et objets mobiles : ceux de la carte, plus ceux propres à cette vue. */
    mobiles(){
        const mobiles = this.worldMap == null ? [] : this.worldMap.entities;
        if(this.#entities.length == 0) return mobiles;
        return mobiles.concat(this.#entities);
    }

    /**
     * Construit la vue écran des entités (taille du sprite, ancrage).
     * Opération lourde : on ne la refait qu'au changement de carte ou de zoom,
     * pas à chaque image.
     */
    createEntityDraws(){
        const sizeCase = this.sizeCase;
        const players = this.worldMap == null ? [] : this.worldMap.players;
        const mobiles = this.mobiles();

        this.#playerDraws = [];
        for(let p = 0; p < players.length; p++)
            if(players[p] != null)
                this.#playerDraws[this.#playerDraws.length] = new EntityDraw(players[p], sizeCase, this.#adjusted);

        this.#entityDraws = [];
        for(let e = 0; e < mobiles.length; e++)
            if(mobiles[e] != null)
                this.#entityDraws[this.#entityDraws.length] = new EntityDraw(mobiles[e], sizeCase, this.#adjusted);
    }

    /**
     * Range chaque sprite dans la case qu'il occupe.
     * Le monde a déjà tick : ici on ne fait que l'écran.
     */
    placeEntityDraws(){
        for(let c = 0; c < this.#cases.length; c++)
            this.#cases[c].entityDraws = [];

        this.placeDraws(this.#playerDraws);
        this.placeDraws(this.#entityDraws);
    }
    placeDraws(draws){
        for(let i = 0; i < draws.length; i++){
            const draw = draws[i];
            const entity = draw.entity;

            const stride = entity.stride();
            if(stride == null){
                draw.toScreen(this.screenFromLocation(entity.x, entity.y, entity.z));
            } else {
                // Entre deux cases : le pas place lui-même le sprite entre les deux.
                draw.toScreen(stride.between(
                    this.screenFromLocation(stride.from.x, stride.from.y, stride.from.z),
                    this.screenFromLocation(stride.to.x, stride.to.y, stride.to.z)));
            }

            const C2D = this.findCaseLocation(entity.x, entity.y, entity.z);
            if(C2D != null) C2D.entityDraws[C2D.entityDraws.length] = draw;
        }
    }

    select(id){ return this.#selection.select(id); }
    moveSelectedTo(cube){ return this.#selection.moveSelectedTo(cube); }
    onSelectedMouse(){ this.#selection.onSelectedMouse(); }
    onTarget(){ this.#selection.onTarget(); }
    selectedMultiDown(){ this.#selection.selectedMultiDown(); }
    selectedMultiUp(){ this.#selection.selectedMultiUp(); }
    selectedMultiMove(){ this.#selection.selectedMultiMove(); }
    selectedEntity(){ return this.#selection.selectedEntity(); }
    selectedTarget(){ return this.#selection.selectedTarget(); }
    containsEntity(entity, x, y, z){ return this.#selection.contains(entity, x, y, z); }

    /**
     * Recalcule les pièces dont il faut masquer le plafond, d'après l'entité
     * sélectionnée. Aucune sélection = on remet tous les plafonds.
     */
    noCeilingFromSelected(){
        const entity = this.selectedEntity();
        if(entity == null) this.#noCeilingZones = [];
        else this.noCeilingFrom(entity.x, entity.y, entity.z);
    }
    /** Pièces contenant ce point : c'est la carte qui sait, on lui demande. */
    noCeilingFrom(x, y, z){
        this.#noCeilingZones = this.worldMap == null ? [] : this.worldMap.zonesAt(x, y, z);
        this.#createCubes = true;
    }
    /** Ce cube fait-il partie d'un plafond à masquer ? wallCeil décide du sort des murs. */
    containsNoCeiling(x, y, z){
        for(let i = 0; i < this.#noCeilingZones.length; i++)
            if(this.#noCeilingZones[i].hides(x, y, z, this.#wallCeil)) return true;
        return false;
    }
    /**
     * Cube du monde. On demande à la carte au lieu de fouiller sa grille :
     * MapView ignore ainsi comment les cubes sont rangés, et pourra afficher
     * aussi bien une carte unique qu'un assemblage de cartes.
     */
    findCube(x, y, z){
        if(this.worldMap == null) return null;
        return this.worldMap.cubeAt(x, y, z);
    }
    /** Ce point fait-il partie du monde ? (différent de « la donnée est chargée »). */
    inWorld(x, y, z, worldMap = this.worldMap){
        if(worldMap == null) return false;
        return worldMap.inBounds(x, y, z);
    }
    /** Case du viewport (losange affiché), pas un cube monde. */
    findCase(x, y){
        for(let i = 0; i < this.cases.length; i++)
            if ( this.cases[i].x == x && this.cases[i].y == y)
                return this.cases[i];
        return null;    
    }
    /** Monde → case visible, via le projecteur (même parallaxe que l'écran). */
    findCaseLocation(x, y, z){
        const c = this.#projector.caseFromLocation(x, y, z);
        return this.findCase(c.x, c.y);
    }
    /** Habitants de la carte d'abord, puis les entités propres à cette vue. */
    findEntity(id){
        if(id == null || id === "") return null;

        if(this.worldMap != null){
            const entity = this.worldMap.findEntity(id);
            if(entity != null) return entity;
        }

        for( let ent = 0; ent < this.entities.length; ent++)
            if( id == this.entities[ent].id )
                return this.entities[ent];
    
        return null;
    }

}
