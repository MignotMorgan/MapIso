/**
 * L'apparence d'un sol, d'un volume ou d'une entité.
 *
 * Une texture est soit une image, soit une simple couleur. La couleur n'est pas
 * un pis-aller : elle permet de construire et de tester un monde entier avant
 * d'avoir le moindre dessin, ce qui compte beaucoup pour démarrer un projet.
 *
 * Une texture se dessine dans un rectangle écran fourni par l'appelant :
 *   - une image est étirée dans ce rectangle ;
 *   - une couleur est rendue en volume, avec un dessus et deux faces ombrées.
 * Le bas du rectangle est toujours la pointe basse du losange de la case, donc
 * la même texture fonctionne pour un sol plat comme pour un cube ou un arbre.
 */
export class Texture{

    #name = "";
    #url = "";
    #image = null;
    #color = null;
    //faces : les trois teintes du volume (dessus, gauche, droite), calculées une fois.
    #faces = null;

    /** options : color ("#4caf50") ou url ("./Images/herbe.png"). */
    constructor(name, options = {}){
        this.#name = name ?? "";
        this.#color = options.color ?? null;
        this.#url = options.url ?? "";

        if(this.#url !== ""){
            this.#image = new Image();
            this.#image.src = this.#url;
        }
        if(this.#color != null) this.#faces = Texture.#shades(this.#color);
    }

    get name(){ return this.#name; }
    get url(){ return this.#url; }
    get image(){ return this.#image; }
    get color(){ return this.#color; }
    get faces(){ return this.#faces; }
    /** L'image est-elle téléchargée ? Une couleur est toujours prête. */
    get ready(){
        if(this.#image == null) return true;
        return this.#image.complete && this.#image.naturalWidth > 0;
    }

    /**
     * Dessine la texture dans le rectangle donné.
     * Pour une couleur, la base occupe le bas du rectangle (un losange de
     * hauteur width/2) et le reste de la hauteur devient le corps du volume.
     */
    draw(paintIso, x, y, width, height){
        if(this.#image != null){
            paintIso.drawImage(this.#image, x, y, width, height);
            return;
        }
        if(this.#faces == null) return;

        const size = width / 2;              // demi-largeur = taille d'une case
        const baseTop = y + height - size;   // sommet haut du losange de base
        const body = baseTop - y;            // hauteur verticale du volume

        if(body <= 0){
            paintIso.fillLosange(x + size, baseTop, size, this.#faces.top);
            return;
        }

        const top = paintIso.losange(x + size, y, size);        // face du dessus
        const base = paintIso.losange(x + size, baseTop, size); // losange au sol

        // Faces latérales : on relie le dessus à la base, à gauche puis à droite.
        paintIso.fillPolygon([top[3], top[2], base[2], base[3]], this.#faces.left);
        paintIso.fillPolygon([top[1], top[2], base[2], base[1]], this.#faces.right);
        paintIso.fillPolygon(top, this.#faces.top);
    }

    // Dessus éclairé, côté gauche moyen, côté droit sombre : suffit à donner du relief.
    static #shades(color){
        return {
            top: Texture.#lighten(color, 1),
            left: Texture.#lighten(color, 0.75),
            right: Texture.#lighten(color, 0.55)
        };
    }

    static #lighten(color, factor){
        const rgb = Texture.#toRgb(color);
        if(rgb == null) return color;
        const clamp = (v) => Math.max(0, Math.min(255, Math.round(v * factor)));
        return `rgba(${clamp(rgb.r)}, ${clamp(rgb.g)}, ${clamp(rgb.b)}, ${rgb.a})`;
    }

    // Accepte #rgb, #rrggbb et #rrggbbaa. Toute autre écriture est renvoyée telle quelle.
    static #toRgb(color){
        if(typeof color != "string") return null;
        let hex = color.trim();
        if(hex[0] != "#") return null;
        hex = hex.slice(1);
        if(hex.length == 3) hex = hex[0]+hex[0] + hex[1]+hex[1] + hex[2]+hex[2];
        if(hex.length != 6 && hex.length != 8) return null;
        return {
            r: parseInt(hex.slice(0, 2), 16),
            g: parseInt(hex.slice(2, 4), 16),
            b: parseInt(hex.slice(4, 6), 16),
            a: hex.length == 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1
        };
    }
}

/**
 * La bibliothèque des textures du jeu, rangées par nom.
 *
 * Un cube ne retient que des noms ("herbe", "pierre") : c'est ce qui rend une
 * carte légère à sauvegarder et à envoyer sur le réseau, et ce qui permet de
 * changer tout l'habillage d'un monde sans toucher à ses données.
 */
export class Textures{

    static #textures = new Map();

    /** Textures.color("herbe", "#4caf50") */
    static color(name, color){
        return Textures.add(new Texture(name, {color:color}));
    }
    /** Textures.image("herbe", "./Images/herbe.png") */
    static image(name, url){
        return Textures.add(new Texture(name, {url:url}));
    }
    static add(texture){
        if(texture == null) return null;
        Textures.#textures.set(texture.name, texture);
        return texture;
    }
    /** null si le nom est inconnu : l'affichage saute simplement cette couche. */
    static get(name){
        if(name == null) return null;
        if(typeof name != "string") return Textures.#textures.get(name.name ?? name.Name) ?? null;
        return Textures.#textures.get(name) ?? null;
    }
    static has(name){ return Textures.#textures.has(name); }
    static remove(name){ return Textures.#textures.delete(name); }
    static clear(){ Textures.#textures.clear(); }
    static get names(){ return Array.from(Textures.#textures.keys()); }
    /** Toutes les images sont-elles téléchargées ? Utile pour un écran de chargement. */
    static get ready(){
        for(const texture of Textures.#textures.values())
            if(!texture.ready) return false;
        return true;
    }
}
