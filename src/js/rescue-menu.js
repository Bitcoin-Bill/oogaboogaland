// Free Puppies Rescue's adoption for the signed-in visitor's own Ooga: six breeds as painted portraits, a name, and a
// personal line. It is built from SVRN Society's menu classes in the shared DSB shell, so it brings no style of its own.
(() => {
  "use strict";
  const BL=window.BL,D=BL.rescueDogs,NAME_MAX=16,PX=4;
  const create=({onOpen=()=>{},onAdopt=()=>false}={})=>{
    let root=null,pups=null,name=null,who=null,line=null,form=null,lineText="",disposed=false,breed=0,stray=-1;
    const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;};
    const pick=i=>{breed=i;for(const b of pups.children)b.setAttribute("aria-pressed",String(Number(b.dataset.breed)===i));};
    // Each portrait is painted once from its pixel face in the breed's own inks, at its own size.
    const portrait=i=>{
      const c=el("canvas"),face=D.FACES[i],ink=D.BREEDS[i].ink;c.width=c.height=face.length*PX;const g=c.getContext("2d");
      face.forEach((row,y)=>{for(let x=0;x<row.length;x++)if(row[x] in D.FACE_INK){g.fillStyle=ink[D.FACE_INK[row[x]]];g.fillRect(x*PX,y*PX,PX,PX);}});
      return c;
    };
    const close=()=>{if(!root?.open)return;root.close();BL.dsbMenuShell.present(root,false);onOpen(false);};
    const adopt=()=>{if(onAdopt({breed,name:BL.donations.sanitize(name.value,NAME_MAX)||name.placeholder,stray}))close();};
    const click=e=>{const b=e.target.closest("button");if(!b)return;if(b.dataset.breed!==undefined)pick(Number(b.dataset.breed));else if(b.dataset.adopt!==undefined)adopt();else if(b.dataset.close!==undefined)close();};
    const keys=e=>{e.stopPropagation();if(e.type!=="keydown")return;if(e.key==="Escape"){e.preventDefault();close();}else if(e.key==="Enter"&&e.target===name){e.preventDefault();adopt();}};
    const cancel=e=>{e.preventDefault();close();};
    const ensure=()=>{
      if(root)return;root=el("dialog",null,"svrn-menu rescue-menu");root.setAttribute("aria-label","Free Puppies Rescue");
      const header=el("header"),title=el("div"),back=el("button","Back");back.type="button";back.dataset.close="";
      title.append(el("small","VAC 1 · CHORA"),el("h2","Free Puppies Rescue"));header.append(title,back);
      pups=el("nav");pups.setAttribute("aria-label","Pick a puppy");
      D.BREEDS.forEach((b,i)=>{const button=el("button");button.type="button";button.dataset.breed=String(i);button.append(portrait(i),el("br"),el("span",b.name));pups.append(button);});
      const body=el("div",null,"svrn-content"),label=el("label");
      name=el("input");name.type="text";name.maxLength=NAME_MAX;name.autocomplete="off";name.spellcheck=false;
      label.append(el("span","Puppy name "),name);who=el("p");
      const go=el("button","Adopt");go.type="button";go.dataset.adopt="";line=el("small",lineText,"svrn-note");
      form=[pups,label,who,go];body.append(el("p","Every Ooga needs a dog! Dogs eat bananas from the pile, and they poop."),label,who,go,line);
      root.append(header,pups,body);document.body.append(root);
      root.addEventListener("click",click);root.addEventListener("keydown",keys);root.addEventListener("keyup",keys);root.addEventListener("cancel",cancel);
    };
    return {close,
      // `ooga` is the display name of the visitor's own Ooga, `suggest` the name offered for its dog, `stray` the stray
      // the adoption was opened on (-1 for none). `signIn` opens it without the adoption, on the personal line alone, so
      // a signed-out visitor sees it where they tapped rather than in a passing toast.
      open:({breed:chosen,ooga,suggest,stray:from=-1,signIn=false})=>{
        if(disposed)return false;ensure();stray=signIn?-1:from;
        for(const n of form)n.style.display=signIn?"none":"";
        if(!signIn){who.textContent=`For your Ooga, ${ooga}.`;name.value="";name.placeholder=suggest;pick(chosen);}
        if(!root.open){root.showModal();BL.dsbMenuShell.present(root,true);onOpen(true);}return true;
      },
      // The personal line is kept until the dialog is first built, so a visit that never adopts builds no dialog.
      setLine:text=>{lineText=text;if(line)line.textContent=text;},
      get isOpen(){return !!root?.open;},get stats(){return {open:!!root?.open,signIn:pups?.style.display==="none",breed,stray,ooga:who?.textContent||null,panels:root?1:0,disposed};},
      dispose:()=>{close();disposed=true;if(root){root.removeEventListener("click",click);root.removeEventListener("keydown",keys);root.removeEventListener("keyup",keys);root.removeEventListener("cancel",cancel);root.remove();root=pups=name=who=line=form=null;}}
    };
  };
  BL.rescueMenu={create,NAME_MAX};
})();
