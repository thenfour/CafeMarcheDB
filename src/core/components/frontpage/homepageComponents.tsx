import { nanoid } from 'nanoid';
import React from "react";
import { EnNlFr, LangSelectString } from 'shared/lang';
import { IsNullOrWhitespace, modulo } from "shared/utils";
//import { HomepageAgendaItemSpec, HomepageContentSpec } from "../../db3/clientAPI";
import { gIconMap } from '../../db3/components/IconMap';
//import * as db3 from "../../db3/db3";
import { SharedAPI } from '../../db3/shared/sharedAPI';
import { Markdown } from "../markdown/Markdown";
import { PublicAgendaItemSpec, PublicFeedResponseSpec, PublicGalleryItemSpec } from '../../db3/shared/publicTypes';

const gSettings = {
    backstageURL: `/backstage`,
    photoCarrouselAutoPlayIntervalMS: 10000,
    portraitNaturalWidth: 830, // vert
    landscapeNaturalWidth: 1500, // horiz
};

export const generateHomepageId = (n: string, instanceKey: string, postId: number) => `${n}_${instanceKey}_${postId}`;

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// const AWrapper = ({ children, ...props }: any) => {
//     return <a {...props as any}>{children}</a>;
// };

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export interface HomepagePhotoPatternProps {
    post: PublicGalleryItemSpec;
    editable?: boolean;
    instanceKey: string; // unique-to-page instance key for generating IDs.
};

export const HomepagePhotoPattern = ({ post, ...props }: HomepagePhotoPatternProps) => {

    const id = (name: string) => generateHomepageId(name, props.instanceKey, post.id);// `${n}_${props.instanceKey}_${post.id}`;

    const info = SharedAPI.files.getPublicGalleryImageInfo(post);

    return <pattern
        id={id("galleryPattern")}
        height="100%" width="100%"
        viewBox={`${info.cropBegin.x} ${info.cropBegin.y} ${info.cropSize.width} ${info.cropSize.height}`}
        preserveAspectRatio="xMidYMid slice"
    >
        {props.editable && <>
            <rect x={info.cropBegin.x} y={info.cropBegin.y} height={info.cropSize.height} width={info.cropSize.width} style={{ fill: "#f0f" }} />
        </>}
        <image
            href={info.imageURI}
            x={0} y={0}
            id={id(`galleryPatternImage`)}
            transform={` translate(${info.cropCenter.x} ${info.cropCenter.y}) rotate(${info.rotate}) translate(${-info.cropCenter.x} ${-info.cropCenter.y})`}
        />
    </pattern>;
};



/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// displays the photo in its original file form, and shows cropping mask. ignores post-effects like rotate.
// the point is to show what the final image would look like if you baked it.
export const HomepagePhotoMaskPattern = ({ post, ...props }: HomepagePhotoPatternProps) => {

    const id = (name: string) => generateHomepageId(name, props.instanceKey, post.id);// `${n}_${props.instanceKey}_${post.id}`;
    const info = SharedAPI.files.getPublicGalleryImageInfo(post);

    /*
        (0,0)+-------------------------------+ (fdwidth, 0)          <- y= 0
             | (cropBegin)                   |
             |  +---------------------+      |                       <- cropTop
             |  |                     |      |
             |  |                     |      |
             |  +---------------------+      |                       <- cropBottom
             |                     (cropEnd) |
             +-------------------------------+ (fdwidth, fdheight)
             |  |                     |
             ^------- 0               |
                ^---- cropLeft        |
                                      ^ cropRight
        .
    */

    const maskMargin = 50;

    return <>
        <pattern
            id={id("galleryPatternMask")}
            height="100%" width="100%"
            viewBox={`${-maskMargin} ${-maskMargin} ${maskMargin * 2 + info.fileDimensions.width} ${maskMargin * 2 + info.fileDimensions.height}`}
            className='galleryPatternMask'
        >
            <image
                href={info.imageURI}
                x={0} y={0}
                id={id(`galleryPatternImage`)}
            />
            <rect x="0" y="0" width={info.fileDimensions.width} height={info.fileDimensions.height} className='imageStroke' />
            {/* TOP mask */}
            {info.maskTopHeight > 0 && <rect x="0" y="0" width={info.fileDimensions.width} height={info.maskTopHeight} className='mask' />}
            {/* BOTTOM mask */}
            {info.maskBottomHeight > 0 && <rect x="0" y={info.cropEnd.y} width={info.fileDimensions.width} height={info.maskBottomHeight} className='mask' />}
            {/* LEFT mask */}
            {info.maskLeftWidth > 0 && info.cropSize.height > 0 && <rect x="0" y={info.cropBegin.y} width={info.maskLeftWidth} height={info.cropSize.height} className='mask' />}
            {/* RIGHT mask */}
            {info.maskRightWidth > 0 && info.cropSize.height > 0 && <rect x={info.cropEnd.x} y={info.cropBegin.y} width={info.maskRightWidth} height={info.cropSize.height} className='mask' />}
            <rect x={info.cropBegin.x} y={info.cropBegin.y} width={info.cropSize.width} height={info.cropSize.height} className='cropStroke' />
        </pattern>
    </>;
};




/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export interface MainSVGRefs {
    photoCaptionRef: SVGForeignObjectElement | null;
    photoSelectRef: SVGForeignObjectElement | null;
    agendaRef: SVGForeignObjectElement | null;
    galleryPhoto1Ref: SVGPolygonElement | null;
    galleryPhoto2Ref: SVGPolygonElement | null;
};

function InstallOrientationChangeListener(proc) {
    // https://stackoverflow.com/questions/44709114/javascript-screen-orientation-on-safari
    // safari orientation support ...
    if (screen && screen.orientation) {
        screen.orientation.addEventListener('change', proc);
        return;
    }

    var mql = window.matchMedia("(orientation: portrait)");

    // https://www.tabnine.com/code/javascript/functions/builtins/MediaQueryList/addEventListener
    if (mql.addEventListener) {
        mql.addEventListener('change', proc);
    } else if (mql.addListener) {
        mql.addListener(proc);
    }

    console.log(`No way to detect orientation change.`);
}

function UninstallOrientationChangeListener(proc) {
    if (screen && screen.orientation) {
        screen.orientation.removeEventListener('change', proc);
        return;
    }

    var mql = window.matchMedia("(orientation: portrait)");

    // https://www.tabnine.com/code/javascript/functions/builtins/MediaQueryList/addEventListener
    if (mql.removeEventListener) {
        mql.removeEventListener('change', proc);
    } else if (mql.removeListener) {
        mql.removeListener(proc);
    }
}

// encapsulates gallery logic
class Gallery {

    private selectedIdx: number; // may be out of bounds; modulo when accessing.
    ab: boolean;
    content: PublicFeedResponseSpec | null;
    //photoIDMap: Record<number, string>;
    instanceKey: string;
    mainSVGRefs: MainSVGRefs;

    photoSelectorRef: HTMLUListElement | null;

    constructor() {
        this.content = null;
        this.instanceKey = "";
        this.selectedIdx = (Math.random() * 1000) | 0;

        this.ab = false; // to swap A and B for transitioning
    }

    setContent(content: PublicFeedResponseSpec | null) {
        this.content = content;
    };

    setPhotoIDMap(instanceKey: string, refs: MainSVGRefs, photoSelectorRef: HTMLUListElement | null) {
        this.instanceKey = instanceKey;
        this.photoSelectorRef = photoSelectorRef;
        this.mainSVGRefs = refs;
    };

    applyStateToDOM() {
        //return;
        if (this.instanceKey === "" || !this.content || (this.content.gallery.length < 1)) {
            //no no no const a = document.getElementById("galleryPhoto2");
            if (this.mainSVGRefs.galleryPhoto2Ref) this.mainSVGRefs.galleryPhoto2Ref.setAttribute("fill", `#0008`);
            return;
        }

        const posts = this.content.gallery;
        const indexInRange = this.bringIndexIntoRange(this.selectedIdx);
        const post = this.content.gallery[indexInRange]!;
        const nextPostID = this.bringIndexIntoRange(this.selectedIdx + 1);
        const nextPost = posts[nextPostID]!;

        const thisPostImage = document.getElementById(`galleryPatternImage_${this.instanceKey}_${post.id}`);
        if (thisPostImage) {
            thisPostImage.setAttribute('href', post.imageFileUri)
        }
        const nextPostImage = document.getElementById(`galleryPatternImage_${this.instanceKey}_${nextPost.id}`);
        if (nextPostImage) {
            nextPostImage.setAttribute('href', nextPost.imageFileUri);
        }

        const a = this.ab ? this.mainSVGRefs.galleryPhoto2Ref : this.mainSVGRefs.galleryPhoto1Ref;
        const b = this.ab ? this.mainSVGRefs.galleryPhoto1Ref : this.mainSVGRefs.galleryPhoto2Ref;
        if (!a || !b) return; // error actually.

        a.setAttribute("fill", `url(#galleryPattern_${this.instanceKey}_${post.id})`);

        if (this.photoSelectorRef) {
            this.photoSelectorRef.style.setProperty("--count", `${posts.length}`);
        }

        a.style.opacity = "100%";
        b.style.opacity = "0%";
    }

    getSelectedPost(): PublicGalleryItemSpec | null {
        if (!this.content) return null;
        return this.content.gallery[this.getSelectedIndex()]! as any; // it's hard to understand the typing here; no time to fix.
    }

    getSelectedIndex(): number {
        return this.bringIndexIntoRange(this.selectedIdx);
    }

    bringIndexIntoRange(index: number): number {
        if (!this.content) return index;
        if (this.content.gallery.length < 1) return index; // nothing will be displayed anyway.
        return modulo(this.selectedIdx, this.content.gallery.length);
    }

    setSelectedIdx(idx) {
        this.selectedIdx = idx;
        this.ab = !this.ab;
        this.applyStateToDOM();
    }

}


/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export interface AgendaItemProps {
    item: PublicAgendaItemSpec;
};

export class AgendaItem extends React.Component<AgendaItemProps> {

    constructor(props: AgendaItemProps) {
        super(props);
        this.state = {};
    }

    render() {
        const post = this.props.item;

        return (<div className="agendaPost">
            {!IsNullOrWhitespace(post.date) && <div className="agendaDate">{post.date}</div>}
            {!IsNullOrWhitespace(post.title) && <div className="agendaTitle">{post.title}</div>}
            {!IsNullOrWhitespace(post.location) && !IsNullOrWhitespace(post.locationURI) && <a rel="noreferrer" target="_blank" href={post.locationURI || ""}><div className="agendaLocation">{gIconMap.Place()}{post.location}</div></a>}
            {!IsNullOrWhitespace(post.location) && IsNullOrWhitespace(post.locationURI) && <div className="agendaLocation">{gIconMap.Place()}{post.location}</div>}
            {!IsNullOrWhitespace(post.time) && <div className="agendaTime">{gIconMap.Schedule()}{post.time}</div>}
            {!IsNullOrWhitespace(post.tags) && <div className="agendaTags">{post.tags}</div>}
            {!IsNullOrWhitespace(post.detailsMarkdown) && <Markdown markdown={post.detailsMarkdown || ""} className="agendaDetails" />}

        </div>
        );
    }
}

const TopRight2 = () => {
    return <div className="toprighttitle">
        <div className="subtitle1"><span className="nowrap">NO-NONSENSE&nbsp;ALL&nbsp;STYLE ORCHESTRA FROM&nbsp;BRUXL</span></div>
        <div className="subtitle2">
            <span className="nowrap">BOOK&nbsp;US! PLAY&nbsp;WITH&nbsp;US! COME&nbsp;SEE&nbsp;US!</span>

            <div className='socicons'>
                {/* from https://simpleicons.org/ */}

                <svg className="socicon" role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><title>Instagram</title><path d="M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.899 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.899-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678c-3.405 0-6.162 2.76-6.162 6.162 0 3.405 2.76 6.162 6.162 6.162 3.405 0 6.162-2.76 6.162-6.162 0-3.405-2.76-6.162-6.162-6.162zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm7.846-10.405c0 .795-.646 1.44-1.44 1.44-.795 0-1.44-.646-1.44-1.44 0-.794.646-1.439 1.44-1.439.793-.001 1.44.645 1.44 1.439z" /></svg>

                <svg className="socicon" role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><title>Facebook</title><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>

                <svg className="socicon" role="img" viewBox="0 0 300 221" xmlns="http://www.w3.org/2000/svg">
                    <image width="300" height="221" href="/homepage/CMmail.png" preserveAspectRatio="xMidYMid slice" />
                </svg>


                {/* <a title="Instagram" href="https://www.instagram.com/cafemarche_bxl/" target="_blank" rel="noreferrer">
                    <svg className="socicon" role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><title>Instagram</title><path d="M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.899 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.899-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678c-3.405 0-6.162 2.76-6.162 6.162 0 3.405 2.76 6.162 6.162 6.162 3.405 0 6.162-2.76 6.162-6.162 0-3.405-2.76-6.162-6.162-6.162zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm7.846-10.405c0 .795-.646 1.44-1.44 1.44-.795 0-1.44-.646-1.44-1.44 0-.794.646-1.439 1.44-1.439.793-.001 1.44.645 1.44 1.439z" /></svg>
                </a>

                <a title="Facebook" href="https://www.facebook.com/orkest.cafe.marche/" target="_blank" rel="noreferrer">
                    <svg className="socicon" role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><title>Facebook</title><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>
                </a>

                <a title="Email" href="mailto:cafemarche@cafemarche.be">
                    <svg className="socicon" role="img" viewBox="0 0 300 221" xmlns="http://www.w3.org/2000/svg">
                        <image width="300" height="221" href="/homepage/CMmail.png" preserveAspectRatio="xMidYMid slice" />
                    </svg>
                </a> */}
            </div>
        </div>
    </div>
};

export interface MainSVGComponentProps {
    content: PublicFeedResponseSpec;
    instanceKey: string; // unique-to-page instance key for generating IDs.
    editable?: boolean;
    //rotate?: number;
    onRefsChanged: (refs: MainSVGRefs) => void;
    lang: EnNlFr;
    onLangChange: (newLang: EnNlFr) => void;
};
export const MainSVGComponent = (props: MainSVGComponentProps) => {

    const photoCaptionRef = React.useRef<SVGForeignObjectElement>(null);
    const photoSelectRef = React.useRef<SVGForeignObjectElement>(null);
    const agendaRef = React.useRef<SVGForeignObjectElement>(null);
    const galleryPhoto1Ref = React.useRef<SVGPolygonElement>(null);
    const galleryPhoto2Ref = React.useRef<SVGPolygonElement>(null);

    React.useEffect(() => {
        props.onRefsChanged({
            photoCaptionRef: photoCaptionRef.current,
            photoSelectRef: photoSelectRef.current,
            agendaRef: agendaRef.current,
            galleryPhoto1Ref: galleryPhoto1Ref.current,
            galleryPhoto2Ref: galleryPhoto2Ref.current,
        });
    }, [
        photoCaptionRef.current,
        photoSelectRef.current,
        agendaRef.current,
        galleryPhoto1Ref.current,
        galleryPhoto2Ref.current,
    ]);

    const bothSvgParams = {
        landscape: {
            svgViewBox: "0 0 2130 1496",
        },
        portrait: {
            svgViewBox: "0 0 1086 2200",
        }
    }

    const svgParams = (window.innerHeight < window.innerWidth) ? bothSvgParams.landscape : bothSvgParams.portrait;

    const getSubtitle = () => {
        switch (props.lang) {
            case 'nl':
                return <>BOEK&nbsp;ONS! SPEEL&nbsp;MET&nbsp;ONS! KOM&nbsp;ONS&nbsp;ZIEN!</>;
            case 'fr':
                return <>RÉSERVEZ&nbsp;! JOUEZ&nbsp;! VENEZ&nbsp;!</>;
            default:
                return <>BOOK&nbsp;US! PLAY&nbsp;WITH&nbsp;US! COME&nbsp;SEE&nbsp;US!</>;
        }
    };

    const getRehearsalInfoText = () => {
        switch (props.lang) {
            case 'nl':
                return <>Repetities&nbsp;elke&nbsp;donderdag&nbsp;om&nbsp;20u&nbsp;in&nbsp;de&nbsp;Kleurdoos</>;
            case 'fr':
                return <>Répétitions&nbsp;tous&nbsp;les&nbsp;jeudis&nbsp;à&nbsp;20h&nbsp;au&nbsp;Kleurdoos</>;
            default:
                return <>Rehearsals&nbsp;every&nbsp;Thursday&nbsp;at&nbsp;20h&nbsp;in&nbsp;the&nbsp;Kleurdoos</>;
        }
    };

    return <div className="galleryContainer">
        <svg viewBox={svgParams.svgViewBox} preserveAspectRatio="xMinYMin meet">
            <defs>
                {
                    props.content.gallery.map((post, idx) => <HomepagePhotoPattern
                        key={post.id}
                        instanceKey={props.instanceKey}
                        post={post as any} // TODO: hackhack asany
                        editable={props.editable}
                    //rotate={props.rotate}
                    />)
                }
                {
                    props.content.gallery.map((post, idx) => <HomepagePhotoMaskPattern
                        key={post.id}
                        instanceKey={props.instanceKey}
                        post={post as any} // TODO: hackhack asany
                        editable={props.editable}
                    //rotate={props.rotate}
                    />)
                }
            </defs>

            {(window.innerHeight < window.innerWidth) ? // landscape (horiz)
                (<g>
                    <polygon points="894,385 2106,296 2020,1398 1074,1496" className="agendaBack" /> {/* green odd background polygon */}
                    <polygon points="1089,383 2072,383 2072,1438 1089,1438" className="agendaBack2" /> {/* yellow rect background */}
                    <polygon points="0,1136 541,1447 0,1398" className="galleryOrange" />{/* orange triangle for photo caption */}
                    <polygon points="541,187 628,176 1086,502" className="galleryPink" />
                    <polygon points="628,176 663,173 1086,502" className="galleryBlue" />
                    <polygon points="0,499 541,187 1086,502 1086,1132 541,1447 0,1136" fill="none" className="galleryPhoto1" id="galleryPhoto1" ref={galleryPhoto1Ref} />
                    <polygon points="0,499 541,187 1086,502 1086,1132 541,1447 0,1136" fill="none" className="galleryPhoto2" id="galleryPhoto2" ref={galleryPhoto2Ref} />
                    <image width="330" height="330" href="/homepage/CMlogo.png" preserveAspectRatio="xMinYMin slice"></image>

                    <text x="2050" y="74" className='subtitle1SVG subtitleSVG portrait' textAnchor='end'>
                        {LangSelectString(props.lang, "NO-NONSENSE ALL STYLE ORCHESTRA FROM BRUXL",
                            "NO-NONSENSE ALL STYLE ORKEST UIT BRUXL",
                            "ORCHESTRE TOUS STYLES NO CHICHIS DE BRUXL"
                        )}
                    </text>

                    <text x="1840" y="130" className='subtitle2SVG subtitleSVG portrait' textAnchor='end'>
                        {getSubtitle()}
                    </text>

                    <text x="1840" y="160" className='subtitle2SVG subtitleSVG portrait repetitieInfo' textAnchor='end'>
                        {getRehearsalInfoText()}
                    </text>

                    <a title="Instagram" href="https://www.instagram.com/cafemarche_bxl/" target="_blank" rel="noreferrer" className='socmedLinkSVG'>
                        <foreignObject x="1860" y="100" width="70" height="70">
                            <svg className="sociconSVG" role="img" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
                                <title>Instagram</title>
                                <path d="M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.899 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.899-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678c-3.405 0-6.162 2.76-6.162 6.162 0 3.405 2.76 6.162 6.162 6.162 3.405 0 6.162-2.76 6.162-6.162 0-3.405-2.76-6.162-6.162-6.162zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm7.846-10.405c0 .795-.646 1.44-1.44 1.44-.795 0-1.44-.646-1.44-1.44 0-.794.646-1.439 1.44-1.439.793-.001 1.44.645 1.44 1.439z" />
                            </svg>
                        </foreignObject>
                    </a>

                    <a title="Facebook" href="https://www.facebook.com/orkest.cafe.marche/" target="_blank" rel="noreferrer">
                        <foreignObject x="1930" y="100" width="70" height="70">
                            <svg className="sociconSVG" role="img" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><title>Facebook</title><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>
                        </foreignObject>
                    </a>

                    <a title="Email" href="mailto:cafemarche@cafemarche.be">
                        <foreignObject x="2000" y="105" width="60" height="60">
                            <svg className="sociconSVG" role="img" viewBox="0 0 300 221" xmlns="http://www.w3.org/2000/svg">
                                <image width="300" height="221" href="/homepage/CMmail.png" preserveAspectRatio="xMidYMid slice" />
                            </svg>
                        </foreignObject>
                    </a>

                    <text x="2020" y="200" className='subtitleSVG portrait langSelect' textAnchor='end'>
                        <tspan dx="21" onClick={() => props.onLangChange('en')} className={`interactable ${props.lang === "en" ? "selected" : "notselected"}`}>EN</tspan>
                        <tspan dx="21" onClick={() => props.onLangChange('nl')} className={`interactable ${props.lang === "nl" ? "selected" : "notselected"}`}>NL</tspan>
                        <tspan dx="21" onClick={() => props.onLangChange('fr')} className={`interactable ${props.lang === "fr" ? "selected" : "notselected"}`}>FR</tspan>
                    </text>

                    <foreignObject x="0" y="1136" width="541" height="262" className="photoCaptionRef" ref={photoCaptionRef}>
                    </foreignObject>
                    <foreignObject x="0" y="499" width="1086" height="637" className="photoSelectRef" ref={photoSelectRef}>
                    </foreignObject>
                    <foreignObject x="1089" y="383" width="983" height="1055" className="agendaRef" ref={agendaRef}>
                    </foreignObject>
                </g>) : // portrait (vert)
                (<g>
                    <polygon points="0,385 1064,296 978,1398 32,1496" className="agendaBack" transform="translate(0 474)" />
                    <polygon points="47,837 1030,837 1030,1892 47,1892" className="agendaBack2" transform="translate(0 20)" />
                    <polygon points="0,1136 541,1447 0,1398" className="galleryOrange" />
                    <polygon points="541,187 628,176 1086,502" className="galleryPink" />
                    <polygon points="628,176 663,173 1086,502" className="galleryBlue" />
                    <polygon points="0,499 541,187 1086,502 1086,1132 541,1447 0,1136" fill="url(#galleryPhotoSrc1)" className="galleryPhoto1" ref={galleryPhoto1Ref} />
                    <polygon points="0,499 541,187 1086,502 1086,1132 541,1447 0,1136" fill="url(#galleryPhotoSrc2)" className="galleryPhoto2" ref={galleryPhoto2Ref} />
                    <image width="330" height="330" href="/homepage/CMlogo.png" preserveAspectRatio="xMinYMin slice"></image>

                    <text x="1065" y="65" className='subtitle1SVG subtitleSVG portrait' textAnchor='end'>
                        {LangSelectString(props.lang, "NO-NONSENSE ALL STYLE ORCHESTRA FROM BRUXL",
                            "NO-NONSENSE ALL STYLE ORKEST UIT BRUXL",
                            "ORCHESTRE TOUS STYLES NO CHICHIS DE BRUXL"
                        )}
                    </text>

                    <text x="860" y="120" className='subtitle2SVG subtitleSVG portrait' textAnchor='end'>
                        {getSubtitle()}
                    </text>

                    <text x="860" y="152" className='subtitleSVG portrait repetitieInfo' textAnchor='end'>
                        {getRehearsalInfoText()}
                    </text>

                    <a title="Instagram" href="https://www.instagram.com/cafemarche_bxl/" target="_blank" rel="noreferrer" className='socmedLinkSVG'>
                        <foreignObject x="870" y="88" width="70" height="70">
                            <svg className="sociconSVG" role="img" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
                                <title>Instagram</title>
                                <path d="M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.899 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.899-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678c-3.405 0-6.162 2.76-6.162 6.162 0 3.405 2.76 6.162 6.162 6.162 3.405 0 6.162-2.76 6.162-6.162 0-3.405-2.76-6.162-6.162-6.162zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm7.846-10.405c0 .795-.646 1.44-1.44 1.44-.795 0-1.44-.646-1.44-1.44 0-.794.646-1.439 1.44-1.439.793-.001 1.44.645 1.44 1.439z" />
                            </svg>
                        </foreignObject>
                    </a>

                    <a title="Facebook" href="https://www.facebook.com/orkest.cafe.marche/" target="_blank" rel="noreferrer">
                        <foreignObject x="935" y="88" width="70" height="70">
                            <svg className="sociconSVG" role="img" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><title>Facebook</title><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>
                        </foreignObject>
                    </a>

                    <a title="Email" href="mailto:cafemarche@cafemarche.be">
                        <foreignObject x="1000" y="93" width="60" height="60">
                            <svg className="sociconSVG" role="img" viewBox="0 0 300 221" xmlns="http://www.w3.org/2000/svg">
                                <image width="300" height="221" href="/homepage/CMmail.png" preserveAspectRatio="xMidYMid slice" />
                            </svg>
                        </foreignObject>
                    </a>

                    <text x="1040" y="190" className='subtitleSVG portrait langSelect' textAnchor='end'>
                        <tspan dx="21" onClick={() => props.onLangChange('en')} className={`interactable ${props.lang === "en" ? "selected" : "notselected"}`}>EN</tspan>
                        <tspan dx="21" onClick={() => props.onLangChange('nl')} className={`interactable ${props.lang === "nl" ? "selected" : "notselected"}`}>NL</tspan>
                        <tspan dx="21" onClick={() => props.onLangChange('fr')} className={`interactable ${props.lang === "fr" ? "selected" : "notselected"}`}>FR</tspan>
                    </text>

                    <foreignObject x="0" y="1136" width="541" height="262" className="photoCaptionRef" ref={photoCaptionRef}>
                    </foreignObject>
                    <foreignObject x="0" y="499" width="1086" height="637" className="photoSelectRef" ref={photoSelectRef}>
                    </foreignObject>
                    <foreignObject x="47" y="1447" width="983" height="445" className="agendaRef" transform="translate(0 20)" ref={agendaRef}>
                    </foreignObject>
                </g>)
            }
        </svg>
    </div>

};

// given a <foreignObject> reference
// and a target DOM element,
// and a common relative-position parent,
// set the DOM element to the position of the foreignObject. Can't just embed directly in the foreignObject because
// the scaling & filters will make things very unpredictable, and that behavior is getting very fringe and not unified across modern browsers.
const correctLayoutFromRef = (refel: SVGForeignObjectElement | undefined | null, targetEl: HTMLDivElement | undefined | null, commonParent: HTMLDivElement | undefined | null) => {
    if (!refel) return;
    if (!targetEl) return;
    if (!commonParent) return;
    const rc = refel.getBoundingClientRect();
    const rcp = commonParent.getBoundingClientRect();
    targetEl.style.left = (rc.left - rcp.left) + "px";
    targetEl.style.top = (rc.top - rcp.top) + "px";
    targetEl.style.height = (rc.height) + "px";
    targetEl.style.width = (rc.width) + "px";
}


/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export interface HomepageMainProps {
    content: PublicFeedResponseSpec;
    className?: string;
    fullPage: boolean; //
    editable?: boolean;
    additionalAgendaChildren?: React.ReactNode;
    lang: EnNlFr;
    onLangChange: (newLang: EnNlFr) => void;
};

export const HomepageMain = ({ content, className, fullPage, editable, lang, onLangChange, ...props }: HomepageMainProps) => {
    const [gallery, setGallery] = React.useState<Gallery>(() => new Gallery());
    gallery.setContent(content);

    const galleryTimer = React.useRef<NodeJS.Timeout | null>(null);

    const [instanceKey, setInstanceKey] = React.useState<string>(() => nanoid());

    //const [refreshSerial, setRefreshSerial] = React.useState<number>(0);// to induce re-render, increment
    const [refreshTrigger, setRefreshTrigger] = React.useState<{}>({});// to induce re-render, increment
    const [layoutUpdateTimer, setLayoutUpdateTimer] = React.useState<NodeJS.Timeout | null>(null);

    const svgRefs = React.useRef<MainSVGRefs>({
        photoCaptionRef: null,
        photoSelectRef: null,
        agendaRef: null,
        galleryPhoto1Ref: null,
        galleryPhoto2Ref: null,
    });

    const root2Ref = React.useRef<HTMLDivElement | null>(null);
    const middleContentRef = React.useRef<HTMLDivElement | null>(null);
    const photoCaptionContainerRef = React.useRef<HTMLDivElement | null>(null);
    const photoSelectContainerRef = React.useRef<HTMLDivElement | null>(null);
    const photoSelectorRef = React.useRef<HTMLUListElement | null>(null);
    const agendaContentRef = React.useRef<HTMLDivElement | null>(null);

    const isMounted = !!root2Ref && !!middleContentRef;

    const syncGalleryParams = () => {
        gallery.setPhotoIDMap(instanceKey, svgRefs.current, photoSelectorRef.current);
    };

    React.useEffect(() => {
        syncGalleryParams();
    }, [svgRefs, instanceKey, content, photoSelectorRef.current]);

    const updateLayout = () => {
        if (layoutUpdateTimer) {
            clearTimeout(layoutUpdateTimer);
        }
        const t = setTimeout(() => { // necessary to let the browser shuffle the layout.
            const root2 = root2Ref.current;
            const psvgRefs = svgRefs.current;
            correctLayoutFromRef(psvgRefs.photoCaptionRef, photoCaptionContainerRef.current, middleContentRef.current);
            correctLayoutFromRef(psvgRefs.photoSelectRef, photoSelectContainerRef.current, middleContentRef.current);
            correctLayoutFromRef(psvgRefs.agendaRef, agendaContentRef.current, middleContentRef.current);

            gallery.applyStateToDOM();

            if (root2) {
                root2.style.opacity = "100%";
            }
            //setRefreshSerial(refreshSerial + 1);
            setLayoutUpdateTimer(null);
        }, 100);
        setLayoutUpdateTimer(t);
    }

    const resetGalleryTimer = () => {
        if (galleryTimer.current !== null) {
            clearTimeout(galleryTimer.current);
        }
        const t = setTimeout(galleryTimerProc, gSettings.photoCarrouselAutoPlayIntervalMS);
        galleryTimer.current = t;
    };

    const onSelectPhoto = (i) => {
        gallery.setSelectedIdx(i);
        resetGalleryTimer();
        setRefreshTrigger({});
    }

    const onClickPhotoNext = () => {
        gallery.setSelectedIdx(gallery.getSelectedIndex() + 1);
        setRefreshTrigger({});
    }

    const onClickPhotoBack = () => {
        gallery.setSelectedIdx(gallery.getSelectedIndex() - 1);
        setRefreshTrigger({});
    }

    const galleryTimerProc = () => {
        if (!isMounted) return;
        onClickPhotoNext();
        resetGalleryTimer();
    }

    // https://stackoverflow.com/questions/58831750/how-to-add-event-in-react-functional-component
    React.useEffect(() => {
        if (fullPage) {
            window.addEventListener("resize", updateLayout);
            InstallOrientationChangeListener(updateLayout);
        }
        updateLayout();

        return () => {
            if (fullPage) {
                window.removeEventListener("resize", updateLayout);
                UninstallOrientationChangeListener(updateLayout);
            }
        };
    }, []);

    React.useEffect(() => {
        updateLayout();
        resetGalleryTimer();
        return () => {
            clearTimeout(galleryTimer.current || undefined);
        };
    }, [root2Ref]);

    const captionMarkdown = gallery.getSelectedPost()?.caption || "";

    return (<div className={`root2 ${className} ${fullPage ? "fullPage" : "embedded"}`} ref={root2Ref}>
        {/* <div className="headerChrome">
            <TopRight2 />
        </div> */}
        <div className="middleContent" ref={middleContentRef}>
            <MainSVGComponent
                content={content}
                lang={lang}
                editable={editable}
                onLangChange={onLangChange}
                //rotate={rotate}
                onRefsChanged={(val) => {
                    svgRefs.current = val;
                    updateLayout();
                    syncGalleryParams();
                }}
                instanceKey={instanceKey}
            />

            {
                // https://stackoverflow.com/questions/41944155/align-text-to-bottom-with-shape-outside-applied
                // very tricky to use shape-outside (to perform the triangle text wrapping)
                // alongside vertically-aligning the wrapped text to bottom. there's not really any built-in way to do it.
                // vertically-aligning is already badly behaving, and all methods of accomplishing it prevent the text
                // interacting with shape-outside.
            }
            <div className="photoCaptionContainer" ref={photoCaptionContainerRef}>
                <div className="photoCaptionContainerWrapShape"></div>
                <Markdown className="photoCaption" markdown={captionMarkdown} />
            </div>

            <div className="photoSelectContainer" ref={photoSelectContainerRef}>
                <div className="photoBackForwardContainer">
                    <div className="photoBack" onClick={onClickPhotoBack}>
                    </div>
                    <div className="photoForward" onClick={onClickPhotoNext}>
                    </div>
                </div>
                <ul className="photoSelector" ref={photoSelectorRef}>
                    {content.gallery.map((post, i) => (
                        <li key={i} onClick={() => onSelectPhoto(i)}>
                            <svg viewBox="-25 -25 350 350" preserveAspectRatio="xMidYMid meet" className={"photoSelectHex" + (i === gallery.getSelectedIndex() ? " selected" : "")} >
                                <polygon className="photoSelectHexShape1" points="150,300 280,225 280,75 150,0 20,75 20,225"></polygon>
                                <polygon className="photoSelectHexShape2" points="150,300 280,225 280,75 150,0 20,75 20,225"></polygon>
                            </svg>
                        </li>
                    ))}
                </ul>
            </div>

            <div className="agendaContent frontpageAgendaContentWrapper" ref={agendaContentRef}>
                <div className="agendaContentContainer">
                    {content.agenda.map((p, i) => {
                        return <AgendaItem key={i} item={p} />;
                    })}
                    {props.additionalAgendaChildren}
                    {editable && (
                        <svg width="100%" height="500">
                            <rect width="100%" height="100%" fill="black"></rect>
                            <rect width="100%" height="100%" fill={`url(#galleryPatternMask_${instanceKey}_${content.gallery[0]?.id})`}></rect>
                        </svg>
                    )}
                </div>
            </div>

            {!!fullPage && <>
                <div className="sponsorsContent">
                    <img className="nbrussel" src="/homepage/CMbrusselicon.png" />
                </div>

                <div className="backstageContainer new"><a href={gSettings.backstageURL}><img src="/homepage/CMbackstage.png"></img></a></div>
            </>
            }
        </div>
    </div>
    );
};

