
class Lyrics {
    
    constructor(lyricObject) {
        this.raw=lyricObject;
        this.value=Lyrics.normalize(this.raw);
    }
    
    getAtTime(time) {
        let key;
        let list=Object.keys(this.value);
        time=parseFloat(time);
        //console.log(time);
        //console.log(this.value);
        for(let i=0;i<list.length;i++) {
            key=list[i];
            //console.log(time>=key && time<list[(i+1<list.length-1) ? i+1 : list.length-1]);
            //console.log(time>=key && time<list[i+1]);
            //console.log(parseFloat(time).toString() + " >= " + parseFloat(key).toString() + " = " + (parseFloat(time)>=parseFloat(key)).toString());
            //console.log(time.toString() + " >= " + key.toString() + " = " + (time>=key).toString());
            if(time>=key && time<list[(i+1<list.length-1) ? i+1 : list.length-1])
                return this.value[key];
            else if(i+1>list.length-1)
                return this.value[list[list.length-1]];
        }
        //return this.value[list[list.length-1]];
        return "";
    }
    
    static normalize(obj) {
        let key,value;
        let res={};
        //console.log(obj);
        for([key, value] of Object.entries(obj))
            res[parseFloat(key)]=value;
        return res;
    }
    
    
}
