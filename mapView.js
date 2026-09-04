import { Core } from 'Control/core.js';
import { CoreIso } from './coreIso.js';
import { Form, DrawForm, FactoryForm } from 'Control/form.js';
import { Control } from 'Control/control.js';
import { Draw } from 'Control/draw.js'; 
import { Factory } from 'Control/factory.js'
import { Mouse } from 'Control/input.js';
import { Resize, Scale } from 'Control/transformation.js';
import { CaseIso } from './caseIso.js';

export class MapView extends Control{
    //grap : Gestion du déplacement de la vue ("grab" pour saisir/déplacer) 
     #grap = {x:0, y:0, adjustment:{x:0,y:0}, border:25, step:25, modified:false, rolled:0};
    //wallCeil : Mode d'affichage des murs et plafonds
    #wallCeil = 0;    
    //selected : Gestion des entités sélectionnées par le joueur
    #selected = { ID:"", Multi:[], Target:"" };   
    //target : Cible actuelle sous le curseur de la souris
    #target = {id:"", case:null, cube:null};
    //selectedMulti : Gestion de la sélection multiple par glisser-déposer
    #selectedMulti = { Source:{X:0,Y:0}, Destination:{X:0,Y:0}, Active:false };
    //selectedMouse : Gestion des pouvoirs/actions avec limitation de portée.
    #selectedMouse = {power:null, target:"",x:0,y:0,z:0, range:3};

    // Carte voxel (cubes + permanents). Remplace l'ancien PageInfo.Map.
    #map = null;
    //entitys : Tableau des entités dynamiques (personnages, objets mobiles)
    #entitys = new Array();
    //entitysDraw : Tableau optimisé des entités pour l'affichage
    #entitysDraw = new Array();
    //permanentsDraw : Tableau des entités permanentes pour l'affichage
    #permanentsDraw = [];
    //temporyCubes : Buffer temporaire pour les nouveaux cubes reçus du serveur
    #temporyCubes = new Array();
    //temporyEntitys : Buffer temporaire pour un ensemble complet d'entités
    #temporyEntitys = null;
    //temporyEntity : Buffer temporaire pour les entités individuelles
    #temporyEntity = new Array();
    //noCeiling : Tableau des zones sans plafond pour la visibilité
    #noCeiling = new Array();
    //resizeCases : Flag indiquant qu'il faut recalculer toutes les cases
    //#resizeCases = true;
    //createCase : Flag indiquant qu'il faut recréer le contenu des cases
    #createCase = false;
    //createCubes : Flag indiquant qu'il faut traiter de nouveaux cubes
    #createCubes = false;
    //createEntityDraw : Flag indiquant qu'il faut recalculer l'affichage des entités
    #createEntityDraw = true;

    //case : Représente la position d'une case sur la grille isométrique
    #case = {x:0,y:0, adjustment:{x:0,y:0}};
    //location : Position de la caméra/vue dans le monde 3D
    #location = {x:-25,y:-5,z:0};
    #frame = {x:100, y:200, width:600, height:300};
    #revise = {screen:{x:0, y:0}, adjustment:{x:0,y:0}, step:25, modified:false, rolled:0};
    #sizeCase;
    #nbrCases= 10;
    #modified = false;
    //#colsCase;
    //#rowsCase;
    //cases : Tableau des cases 3D visibles à l'écran
    #cases = [];
    //maxZ : Niveau maximum d'affichage en profondeur (altitude)
    #maxZ = 10;
    constructor(){
        super();
        //this.nbrCases = 10;
        //this.#sizeCase = 3;
        //this.#colsCase = 20;
        //this.#rowsCase = 20;
    }

    initialize(){
        super.initialize();
        this.modify();
    }
    tick(){
        super.tick();
        if(this.#modified)
            this.modify();
    }
    get case(){ return this.#case; }
    set case(value){ this.#case = value; }
    get location(){ return this.#location; }
    get frame(){ return this.#frame; } //Supprimer!!
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


    get grap(){ return this.#grap; }
    get wallCeil(){ return this.#wallCeil; }
    get selected(){ return this.#selected; }
    get target(){ return this.#target; }
    get selectedMulti(){ return this.#selectedMulti; }
    get selectedMouse(){ return this.#selectedMouse; }
    //get cases3D(){ return this.#cases3D; }
    get map(){ return this.#map; }
    set map(value){ this.#map = value; } // assigner avant createCubes / findEntityID
    get entitys(){ return this.#entitys; }
    get entitysDraw(){ return this.#entitysDraw; }
    get permanentsDraw(){ return this.#permanentsDraw; }
    get temporyCubes(){ return this.#temporyCubes; }
    get temporyEntitys(){ return this.#temporyEntitys; }
    get temporyEntity(){ return this.#temporyEntity; }
    get noCeiling(){ return this.#noCeiling; }
    //get resizeCases(){ return this.#resizeCases; }
    get createCase(){ return this.#createCase; }
    get createCubes(){ return this.#createCubes; }
    get createEntityDraw(){ return this.#createEntityDraw; }

    modified(){ this.#modified = true; }
    modify(){
        this.#sizeCase = this.sizeCaseFrame();
        this.createCases();
    }

    newCase(x, y ){
        const c = CoreIso.FactoryElementIso.createCase(x, y);
        c.screen = this.screenFromCase(x, y );
        return c;
    }
    fakeCase(){
        return { x : 0, y : 0, adjustment : { x : 0, y : 0 } };
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
    redress(){
        const redressed = {x:0, y:0, width:0, height:0};
        const rect = this.Rectangle.rectangleBackground();
        redressed.x = rect.x + this.#revise.adjustment.x;
        redressed.y = rect.y + this.#revise.adjustment.y;
        redressed.width = rect.width;
        redressed.height = rect.height;
        //console.log(redressed);
        return redressed;
    }
    caseFromMouse(){
        const inside = this.Mouse.inside();
        // Coordonnées relatives au coin haut-gauche du contrôle
        //const x = inside.x - this.Border.left;
        //const y = inside.y - this.Border.top;
        //const x = this.Absolute.x - this.Border.left;
        //const y = this.Absolute.y - this.Border.top;
        const x = Core.mouse.x - this.form.Inside.x;// - this.form.Border.left;
        const y = Core.mouse.y - this.form.Inside.y;// - this.form.Border.top;
        return this.caseFromScreen(x, y);
    };
    caseFromScreen2(x, y){
        const sizeCase = this.sizeCase;
        const redressed = this.redress();
        let c = this.fakeCase();

        x -= (redressed.x + sizeCase);
        y -= redressed.y;

        x = ((x/sizeCase)*100);
        y = ((y/sizeCase)*100);
        //y = ((y-(sizeCase/2))/sizeCase)*100;  

        let pY = ((2*y-x)/2);
        let pX = (x+pY);
    
        c.y = Math.round(pY/100);
        c.x = Math.round(pX/100);
    
        c.adjustment.x = Math.round(x-((c.x-c.y)*100));
        c.adjustment.y = Math.round(y-((c.x+c.y)*50));

        return c;
    };
    caseFromScreen(x, y){
        const sizeCase = this.sizeCase;
        const redressed = this.redress();
        let c = this.fakeCase();

        x -= (redressed.x + sizeCase);
        y -= redressed.y;
        y -= (sizeCase/2);

        x = ((x/sizeCase)*100);
        y = ((y/sizeCase)*100);
        //y = ((y-(sizeCase/2))/sizeCase)*100;  

        let pY = ((2*y-x)/2);
        let pX = (x+pY);
    
        c.y = Math.round(pY/100);
        c.x = Math.round(pX/100);
    
        c.adjustment.x = Math.round(x-((c.x-c.y)*100));
        c.adjustment.y = Math.round(y-((c.x+c.y)*50));

        return c;
    };
    screenFromCase(x, y){
        const sizeCase = this.sizeCase;
        const redressed = this.redress();
        
        return {
            x: ((x - y) * sizeCase) + redressed.x + sizeCase,
            y: ((x + y) * sizeCase / 2) + redressed.y
        };
    };
 
    //A faire!!!
    caseFromLocation(x, y, z){
        const c = this.fakeCase();
        return c;
    }

    screenFromLocation(x, y, z){
        const sizeCase = this.sizeCase;
        const c = this.fakeCase();
        const screen = {x:0,y:0};
        // === CALCUL DES COORDONNÉES RELATIVES À LA CAMÉRA ===
    
    /**
     * Coordonnée X relative avec correction de parallaxe :
     * - (L_X - Location.X) : position relative à la caméra
     * - (L_Z - Location.Z) : correction de la parallaxe verticale
     */
        c.x = x - this.location.x - (z - this.location.z);
    
    /**
     * Coordonnée Y relative avec correction de parallaxe :
     * Même principe que pour X
     */
        c.y = y - this.location.y - (z - this.location.z);
    
    // === CONVERSION EN COORDONNÉES ÉCRAN ===
    
    // Application des formules isométriques standard
        screen.x = parseInt((c.x - c.y) * sizeCase);
        screen.y = parseInt((c.x + c.y) * sizeCase / 2);
    
    // Décalage horizontal d'un cube pour le centrage de l'affichage
        screen.x += sizeCase;
        return screen;
    };
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
    }


    
    /**
     * Remplit chaque case visible avec la colonne de cubes monde.
     * px/py : origine caméra + offset case, moins z caméra (parallaxe).
     * À z croissant on ajoute z à x et y : un étage « recule » en iso.
     */
    createCubes()
    {
        if(this.map == null)return;
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





/**
 * CALCUL DU VECTEUR ENTRE DEUX CASES
 * Calcule le déplacement nécessaire en pixels pour aller d'une case à une autre
 * 
 * @param {Object} case_src - Case source {X, Y, Adjustment:{X,Y}}
 * @param {Object} case_dest - Case destination {X, Y, Adjustment:{X,Y}}
 * @returns {Object} Vecteur de déplacement {X, Y} en pixels
 * 
 * PRINCIPE :
 * Cette fonction calcule la différence vectorielle entre deux cases en tenant compte :
 * 1. De leurs coordonnées isométriques (partie entière)
 * 2. De leurs ajustements sous-pixel (partie décimale)
 */
    caseToCase(case_src, case_dest){
    // === CALCUL DES DIFFÉRENCES DE COORDONNÉES ===
        let cX = case_dest.x - case_src.x;  // Différence en X isométrique
        let cY = case_dest.y - case_src.y;  // Différence en Y isométrique
    
    // === CONVERSION EN DÉPLACEMENT PIXEL ===
        return {
        // Composante X : utilise la formule isométrique (cX-cY)*100 + ajustements
            x: ((cX-cY)*100) + case_dest.adjustment.x - case_src.adjustment.x,
        // Composante Y : utilise la formule isométrique (cX+cY)*50 + ajustements  
            y: ((cX+cY)*50) + case_dest.adjustment.y - case_src.adjustment.y
        };
    };
/**
 * CONVERSION CASE ISOMÉTRIQUE VERS COORDONNÉES ÉCRAN
 * Convertit des coordonnées de case isométrique en position écran en pixels
 * 
 * @param {number} Case_X - Coordonnée X de la case isométrique
 * @param {number} Case_Y - Coordonnée Y de la case isométrique  
 * @param {number} sizecube - Taille d'un cube en pixels (facteur d'échelle)
 * @returns {Object} Position écran {X, Y} en pixels
 * 
 * FORMULES ISOMÉTRIQUES FONDAMENTALES :
 * Ces formules transforment un espace 2D isométrique en coordonnées écran :
 * - screen_x = (iso_x - iso_y) * taille_cube
 * - screen_y = (iso_x + iso_y) * taille_cube / 2
 * 
 * EXPLICATION GÉOMÉTRIQUE :
 * - La différence (Case_X - Case_Y) donne la position horizontale à l'écran
 * - La somme (Case_X + Case_Y) divisée par 2 donne la position verticale
 * - Ces formules créent la perspective isométrique à 30° typique
 */
    caseToScreen(case_x, case_y, sizecube){
    // Position horizontale : différence des coordonnées * taille cube
        let pointX = parseInt((case_x - case_y) * sizecube);
    // Position verticale : somme des coordonnées * taille cube / 2
        let pointY = parseInt((case_x + case_y) * sizecube / 2);
        return {x:pointX,y:pointY};
    };

/**
 * CONVERSION COORDONNÉES MONDE 3D VERS ÉCRAN
 * Convertit une position 3D absolue du monde en coordonnées écran visibles
 * 
 * @param {number} L_X - Coordonnée X absolue dans le monde
 * @param {number} L_Y - Coordonnée Y absolue dans le monde
 * @param {number} L_Z - Coordonnée Z absolue dans le monde (altitude)
 * @param {number} sizecube - Taille d'un cube en pixels
 * @returns {Object} Position écran {X, Y} en pixels
 * 
 * PRINCIPE DE LA PROJECTION 3D ISOMÉTRIQUE :
 * 1. Soustrait la position de la caméra (Location) pour obtenir les coordonnées relatives
 * 2. Applique la correction de parallaxe pour la profondeur Z
 * 3. Convertit en coordonnées écran avec les formules isométriques
 * 4. Ajoute un décalage horizontal d'un cube pour le centrage
 * 
 * CORRECTION DE PARALLAXE :
 * La différence d'altitude (L_Z - Location.Z) affecte la position apparente :
 * - Plus un objet est haut, plus il semble décalé vers le coin supérieur-gauche
 * - Cette correction simule la perspective isométrique 3D
 */
    locationToScreen(location_x, location_y, location_z, sizecube){
    // === CALCUL DES COORDONNÉES RELATIVES À LA CAMÉRA ===
    
    /**
     * Coordonnée X relative avec correction de parallaxe :
     * - (L_X - Location.X) : position relative à la caméra
     * - (L_Z - Location.Z) : correction de la parallaxe verticale
     */
        let case_x = location_x - this.location.x - (location_z - this.location.z);
    
    /**
     * Coordonnée Y relative avec correction de parallaxe :
     * Même principe que pour X
     */
        let case_y = location_y - this.location.y - (location_z - this.location.z);
    
    // === CONVERSION EN COORDONNÉES ÉCRAN ===
    
    // Application des formules isométriques standard
        let pointX = parseInt((case_x - case_y) * sizecube);
        let pointY = parseInt((case_x + case_y) * sizecube / 2);
    
    // Décalage horizontal d'un cube pour le centrage de l'affichage
        pointX += sizecube;
        return {x:pointX, y:pointY};
    };
/**
 * GESTION DE LA CIBLE DE SOURIS AVEC LIMITATION DE PORTÉE
 * Détermine la position et la cible sous le curseur pour les actions avec portée limitée
 * Principalement utilisé pour les AOE (Area of Effect) et pouvoirs à distance
 * 
 * FONCTIONNEMENT :
 * 1. Trouve la position sous le curseur (cube ou terrain)
 * 2. Applique la limitation de portée si une entité est sélectionnée
 * 3. Recherche une cible valide à cette position
 * 4. Met à jour SelectedMouse avec les coordonnées et la cible
 * 
 * TODO: Changer X,Y,Z en Cube et supprimer Target
 */
    onSelectedMouse(){
    // === DÉTERMINATION DE LA POSITION SOUS LE CURSEUR ===
    
        let C2D = this.caseFromMouse();  // Trouve la case 3D sous le curseur
        let x = 0, y = 0, z = 0;
    
        if(C2D != null && C2D.cubes.length > 0 )
        {
        // S'il y a des cubes dans la case, prend le cube le plus haut
            let topCube = C2D.cubes[C2D.cubes.length-1];
            x = topCube.x;
            y = topCube.y;
            z = topCube.z;
        
        // Code désactivé pour les ajustements précis dans la case
        // TODO: Réimplémenter si nécessaire pour la précision sous-pixel
        /*
        if( PageInfo.MapInfo.Adjusted )
        {
            SelectedMouse.Adjustment.X = Math.floor( ((Mouse.X - PageInfo.Frame.X - C3D.Screen.X) / PageInfo.MapInfo.SizeCube)*100 );
            SelectedMouse.Adjustment.Y = Math.floor( ((Mouse.Y - PageInfo.Frame.Y - (C3D.Screen.Y + (PageInfo.MapInfo.SizeCube/2))) / PageInfo.MapInfo.SizeCube)*100 );
        }
        */
        } else {
        // Aucun cube trouvé : utilise la position du terrain à ce niveau
        x = this.location.x + this.case.x;
        y = this.location.y + this.case.y;
        z = this.location.z;
        }
    
        // === APPLICATION DE LA LIMITATION DE PORTÉE ===
    
        if( this.selected.ID != "" && this.selectedMouse.range > 0)
        {
            let entity = this.selectedEntity();  // Entité actuellement sélectionnée
            if(entity != null)
            {
                // Limite la position X dans la portée autorisée
                if(x - entity.x > this.selectedMouse.range)
                    x = entity.x + this.selectedMouse.range;
                else if(x - entity.x < -this.selectedMouse.range)
                    x = entity.x - this.selectedMouse.range;
                
                // Limite la position Y dans la portée autorisée
                if(y - entity.y > this.selectedMouse.range)
                    y = entity.y + this.selectedMouse.range;
                else if(y - entity.y < -this.selectedMouse.range)
                    y = entity.y - this.selectedMouse.range;
                
                // Limite la position Z dans la portée autorisée
                if(z - entity.z > this.selectedMouse.range)
                    z = entity.z + this.selectedMouse.range;
                else if(z - entity.z < -this.selectedMouse.range)
                    z = entity.z - this.selectedMouse.range;
            }
        }

        // === MISE À JOUR DES COORDONNÉES FINALES ===
    
        this.selectedMouse.x = x;
        this.selectedMouse.y = y;
        this.selectedMouse.z = z;

        // === RECHERCHE D'UNE CIBLE À CETTE POSITION ===
    
        if(this.map == null) return;
    
        this.selectedMouse.target = "";  // Réinitialise la cible
        let target = null;
    
        const permanents = this.map.permanents ?? this.map.Permanents ?? [];
        // D'abord les décors ciblables, puis les mobiles (un bâtiment masque un perso au même cube).
        for( let p = 0; p < permanents.length; p++)
            if( permanents[p] != null && 
                permanents[p].canTarget && 
                this.contains_Entity(permanents[p], this.selectedMouse.x, this.selectedMouse.y, this.selectedMouse.z) )
                target = permanents[p];
    
        if(target == null)
            for( let t = 0; t < this.entitys.length; t++)
                if( this.entitys[t] != null && 
                    this.entitys[t].canTarget && 
                    this.contains_Entity(this.entitys[t], this.selectedMouse.x, this.selectedMouse.y, this.selectedMouse.z) )
                target = this.entitys[t];
    
        if(target != null){
            this.selectedMouse.target = target.id;
        } else {
            // Pas de hit 3D : rectangle sprite (utile si le volume voxel est petit).
            const inside = this.Mouse.inside();
            let mx = inside.x;
            let my = inside.y;
        
            for(let i = 0; i < this.entitysDraw.length; i++){
                if(this.entitysDraw[i].screen.x < mx && 
                   mx < this.entitysDraw[i].screen.x + this.entitysDraw[i].width && 
                   this.entitysDraw[i].screen.y < my && 
                   my < this.entitysDraw[i].screen.y + this.entitysDraw[i].height){
                    this.selectedMouse.target = this.entitysDraw[i].id;
                    break;
                }
            }
        }
    };
/**
 * GESTION DE LA CIBLE PRINCIPALE SOUS LE CURSEUR
 * Met à jour l'objet Target avec la case, le cube et l'entité sous le curseur
 * Utilisé pour les interactions directes (clic, sélection, mouvement)
 * 
 * FONCTIONNEMENT :
 * 1. Trouve la case 3D sous le curseur
 * 2. Identifie le cube "sol" de cette case
 * 3. Recherche une entité par collision 2D à l'écran
 * 4. Met à jour les références dans l'objet Target global
 */
    onTarget(){
        let C2D = this.findCase(this.case.x, this.case.y);
        this.target.case = C2D;
    
        // Sol = cube traversable le plus haut de la colonne (CaseIso.toFloors).
        if(C2D != null) 
            this.target.cube = C2D.toFloors();
        else 
            this.target.cube = null;
    
        this.target.id = "";
    
        let temp_EntitysDraw = this.entitysDraw;
        const inside = this.Mouse.inside();
        let mx = inside.x;
        let my = inside.y;
        for(let d = 0; d < temp_EntitysDraw.length; d++){
            if(temp_EntitysDraw[d].screen.x < mx && 
                mx < temp_EntitysDraw[d].screen.x + temp_EntitysDraw[d].width && 
                temp_EntitysDraw[d].screen.y < my && 
                my < temp_EntitysDraw[d].screen.y + temp_EntitysDraw[d].height){
                this.target.id = temp_EntitysDraw[d].id;
                break;
            }
        }
    };
/**
 * DÉMARRAGE DE LA SÉLECTION MULTIPLE (GLISSER-DÉPOSER)
 * Initialise une sélection multiple quand l'utilisateur appuie sur le bouton de la souris
 * Crée un rectangle de sélection qui s'étendra jusqu'au relâchement
 */
    selectedMulti_Down(){
        const multi = this.selectedMulti;
        const inside = this.Mouse.inside();
        multi.Active = true;
        this.selected.Multi = [];
        // Coin départ du rectangle, relatif au contrôle (pas au formulaire).
        multi.Source.X = inside.x;
        multi.Source.Y = inside.y;
        multi.Destination.X = inside.x;
        multi.Destination.Y = inside.y;
    };
    selectedMulti_Up(){
        this.selectedMulti.Active = false;
    };
    /** Recalcule selected.Multi : toute EntityDraw dont le sprite coupe le rectangle. */
    selectedMulti_Move(){
        const selected = this.selected;
        const multi = this.selectedMulti;
        const inside = this.Mouse.inside();
        selected.Multi = [];
        multi.Destination.X = inside.x;
        multi.Destination.Y = inside.y;

        for (let i = 0; i < this.entitysDraw.length; i++){
            const draw = this.entitysDraw[i];
            if(multi.Source.X < multi.Destination.X){
            if(draw.screen.x > multi.Destination.X) continue;
            if(draw.screen.x + draw.width < multi.Source.X) continue;
            }
            else if(multi.Source.X > multi.Destination.X){
            if(draw.screen.x > multi.Source.X) continue;
            if(draw.screen.x + draw.width < multi.Destination.X) continue;
            }
        
            if(multi.Source.Y < multi.Destination.Y){
            if(draw.screen.y > multi.Destination.Y) continue;
                if(draw.screen.y + draw.width < multi.Source.Y) continue;
            }
            else if(multi.Source.Y > multi.Destination.Y){
                if(draw.screen.y > multi.Source.Y) continue;
                if(draw.screen.y + draw.width < multi.Destination.Y) continue;
            }
        
            selected.Multi[selected.Multi.length] = draw.id;
        }
    }

/**
 * RACCOURCI : Obtient l'entité actuellement sélectionnée
 * @returns {Object|null} L'objet entité sélectionnée ou null si aucune sélection
 */
    selectedEntity(){ return this.findEntityID(this.selected.ID); };
    selected_Entity(){ return this.selectedEntity(); };
    selectedTarget(){ return this.findEntityID(this.selected.Target); };
    selected_Target(){ return this.selectedTarget(); };
    /**
     * Point 3D dans le volume d'une entité.
     * Délègue à Entity.contains ; sinon lit width/x camelCase ou PascalCase.
     */
    contains_Entity(entity, pX, pY, pZ){
        if(entity == null) return false;
        if(typeof entity.contains === "function") return entity.contains(pX, pY, pZ);
        const width = entity.width ?? entity.Width;
        const height = entity.height ?? entity.Height;
        const x = entity.x ?? entity.X;
        const y = entity.y ?? entity.Y;
        const z = entity.z ?? entity.Z;
        return (pX <= x) && (pX > x - width)
        && (pY <= y) && (pY > y - width)
        && (pZ >= z) && (pZ < z + height);
    };
    /** Zones où on ne dessine pas le plafond (vue intérieure). */
    containsNoCeiling(x, y, z){
        for(let i = 0; i < this.#noCeiling.length; i++){
            const n = this.#noCeiling[i];
            if(n.x == x && n.y == y && n.z == z) return true;
        }
        return false;
    };
    /** Accès O(1) dans la grille 3D de this.map. Hors limites → null. */
    findCube(x, y, z){
        if(this.map == null) return null;
        const cubes = this.map.cubes ?? this.map.Cubes;
        if(!cubes || cubes.length == 0) return null;
        if(!this.contains_Map(x,y,z, this.map)) return null;
        return cubes[x]?.[y]?.[z] ?? null;
    };
    contains_Map(pX, pY, pZ, map){
        const width = map.width ?? map.Width;
        const height = map.height ?? map.Height;
        const depth = map.depth ?? map.Depth;
        return 0 <= pX && pX < width &&
           0 <= pY && pY < height &&
           0 <= pZ && pZ < depth;
    };
    /** Case du viewport (losange affiché), pas un cube monde. */
    findCase(x, y){
        for(let i = 0; i < this.cases.length; i++)
            if ( this.cases[i].x == x && this.cases[i].y == y)
                return this.cases[i];
        return null;    
    };
    /** Monde → case caméra (même parallaxe que screenFromLocation). */
    findCaseLocation(x, y, z){
        x = x - this.location.x - (z - this.location.z);
        y = y - this.location.y - (z - this.location.z);
        return this.findCase(x,y);
    };
    /** Permanents de la carte d'abord, puis #entitys. */
    findEntityID(id){
        if(this.map != null){
            const permanents = this.map.permanents ?? this.map.Permanents ?? [];
            for( let p = 0; p < permanents.length; p++)
                if(permanents[p].id == id)
                    return permanents[p];
        }

        for( let ent = 0; ent < this.entitys.length; ent++)
            if( id == this.entitys[ent].id )
                return this.entitys[ent];
    
        return null;
    };

};

export class DrawMapView extends Draw {
    constructor(control){
        super(control);
    }
    draw(){
        const paint = this.control.Paint;
        //paint.clear();
        super.draw();

        this.drawGrid();
        this.drawLosange(this.control.case.x, this.control.case.y);
        this.drawCaseNumbers();
        //this.drawInfo();

    }
    drawGrid(){
        const paint = this.Paint;
        const control = this.control;
        const rect = control.Rectangle.rectangleBackground();
        const ctx = paint.context;
        const sizeCase = control.sizeCase;
        const nbrCases = control.nbrCases-1;
        const maxCases = (control.nbrCases*2)-1;

        const color = "#043296ff";
        const lineWidth = 2;

        for( let x = 0; x <= nbrCases; x++){
            let from = control.screenFromCase(x, 0-x);
            let to = control.screenFromCase(maxCases-x, 0-x);
            paint.drawLine(from.x, from.y, to.x, to.y, color, lineWidth);
            
            from = control.screenFromCase(x, x+1);
            to = control.screenFromCase(maxCases-x, x+1);
            paint.drawLine(from.x, from.y, to.x, to.y, color, lineWidth);

            from = control.screenFromCase(x, 0-x);
            to = control.screenFromCase(x, x+1);
            paint.drawLine(from.x, from.y, to.x, to.y, color, lineWidth);

            from = control.screenFromCase(nbrCases+x+1, 0-(nbrCases-x));
            to = control.screenFromCase(nbrCases+x+1, nbrCases+1-x);
            paint.drawLine(from.x, from.y, to.x, to.y, color, lineWidth);
        }
        //paint.borderRectangle(rect.x, rect.y, rect.width, rect.height, "black", 2);
    }
    drawCaseNumbers(){
        const control = this.control;
        const paint = this.Paint;
        const sizeCase = control.sizeCase;
        const nbrCases = control.nbrCases;
        const maxCases = (control.nbrCases*2);
        const font = { family: "Arial", size: 10, style: "bold", color: "#000" };
        
        for(let x = 0-maxCases; x <= maxCases; x++){
            for(let y = 0-maxCases; y <= maxCases; y++){
                let c = control.screenFromCase(x, y);
                const abs = Math.abs(x)+Math.abs(y);
                //if(x - y >= -2 && x + y >= -2 && abs <= nbrCases*2){
                
                //if( x+y < -2 || x+y > nbrcube*2 || x-y < -1 || x-y > nbrcube*2+1 )continue;
                if(x - y >= -2 && x + y >= -2 && abs <= maxCases){
                    paint.drawText(c.x-sizeCase/4, c.y+sizeCase/2, `${x},${y}`, font);
                }
            }
        }
    }
    drawGrid2(){
        const paint = this.Paint;
        const control = this.control;
        const ctx = paint.context;
        const sizeCase = control.sizeCase;
        const nbrCasesFrame = control.nbrCases;

        const color = "#2bec05ff";
        const lineWidth = 2;

        for( let x = 0; x <= nbrCasesFrame; x++){
            let from = control.screenFromCase(x, 0-x);
            let to = control.screenFromCase((nbrCasesFrame*2)-x, 0-x);
            paint.drawLine(from.x, from.y, to.x, to.y, color, lineWidth);
            
            from = control.screenFromCase(x, x);
            to = control.screenFromCase((nbrCasesFrame*2)-x, x);
            paint.drawLine(from.x, from.y, to.x, to.y, color, lineWidth);

            from = control.screenFromCase(x, 0-x);
            to = control.screenFromCase(x, x);
            paint.drawLine(from.x, from.y, to.x, to.y, color, lineWidth);

            from = control.screenFromCase(nbrCasesFrame+x, 0-nbrCasesFrame+x);
            to = control.screenFromCase(nbrCasesFrame+x, nbrCasesFrame-x);
            paint.drawLine(from.x, from.y, to.x, to.y, color, lineWidth);
        }
        paint.borderRectangle(control.frame.x, control.frame.y, control.frame.width, control.frame.height, "black", 2);
    }
    drawCaseNumbers2(){
        const control = this.control;
        const paint = this.Paint;
        const sizeCase = control.sizeCase;
        const nbrCasesFrame = control.nbrCases;//Frame();
        const font = { family: "Arial", size: 10, style: "bold", color: "#000" };
        
        for(let x = 0; x <= nbrCasesFrame*2; x++){
            for(let y = 0; y <= nbrCasesFrame*2; y++){
                let c = control.screenFromCase(x, -y);
                if(x + y <= nbrCasesFrame*2 && x - y >= -1 && x !== nbrCasesFrame*2){
                    paint.drawText(c.x, c.y+sizeCase/2, `${x},${y}`, font);
                }
                c = control.screenFromCase(x, y);
                if(x + y <= (nbrCasesFrame*2)-1 && x - y >= 0 && y !== 0){
                    paint.drawText(c.x-5, c.y+sizeCase/2, `${x},${y}`, font);
                }
            }
        }
    }
    drawInfo(){ //SUPPRIMER!!!
        const paint = this.Paint;
        const control = this.control;
        
        const font = { family: "Arial", size: 12, style: "bold", color: "#000" };
        const inside = control.Mouse.inside();
        const c = control.case;
        const nbrCasesFrame = control.nbrCases;
        const sizeCase = control.sizeCase;
        const screen = control.screenFromCase(c.x, c.y);
        const rect = control.Rectangle.rectangleBackground();
        const col = 50;//rect.x + 10;
        const line = 50;//rect.y;
        const space = 15;
        
        paint.drawText(col, line+space, `Inside: ${inside.x}, ${inside.y}`, font);
        paint.drawText(col, line+space*2, `Case: ${c.x}, ${c.y}`, font);
        paint.drawText(col, line+space*3, `Adjustment: ${c.adjustment.x}%, ${c.adjustment.y}%`, font);
        paint.drawText(col, line+space*4, `Nbr cases: ${nbrCasesFrame}`, font);
        paint.drawText(col, line+space*5, `Size case: ${sizeCase}`, font);
        paint.drawText(col, line+space*6, `Screen: ${screen.x}, ${screen.y}`, font);
    }
    drawLosange(cx, cy){
        const paint = this.Paint;
        const control = this.control;
        const ctx = paint.context;
        //const rect = control.redress();
        const rect = control.Rectangle.rectangleBackground();
        const width = control.form.Size.width;
        const height = control.form.Size.height;
        const left = rect.x;
        const top = rect.y;
        
        ctx.fillStyle = "#ff0000";
        for(let x = 0; x < width; x++){
            for(let y = 0; y < height; y++){
                const c = control.caseFromScreen(x, y);
                if(c.x === cx && c.y === cy){
                    // Dessiner un pixel (fillRect 1x1)
                    ctx.fillRect(x, y, 1, 1);
                }
            }
        }
    }
}

export class MouseIso extends Mouse{
     constructor(control){
        super(control);
    }
     hover(){
        super.hover();
        const control = this.control;
        if(Core.mousehover.control !== control)return;
        control.case = control.caseFromMouse();
    }
    wheel(deltaX, deltaY){
        const control = this.control;
        control.nbrCases = deltaY < 0 ? control.nbrCases -= 1 : control.nbrCases += 1;
    }
}

export class ResizeIso extends Resize{
    constructor(control){
        super(control);    
    }   
    to(width, height=width){
        const control = this.control;
        height = (width - control.Border.left - control.Border.right)/2;
        height += control.Border.top + control.Border.bottom;
        super.to(width, height);
        this.control.modified();
    }
}

export class ScaleIso extends Scale{
    constructor(control){
        super(control);    
    }
    to(ratio_width, ratio_height){
        //super.to(ratio_width, ratio_width/2);
        //this.control.modified();
    }
}


/*
export class FactoryMapView extends Factory {  
    createControl(){ return new MapView(this.createFactoryElement()); }
    createFactoryElement(){ return new FactoryElementIso(); }
    createDraw(control){ return new DrawMapView(control); }
    createMouse(control){ return new MouseIso(control); }
    createResize(control){ return new ResizeIso(control); }
    createScale(control){ return new ScaleIso(control); }
}

export class FactoryElementIso{
    constructor(){}
    createCase(x, y){ return new Case(x, y); }
}
*/