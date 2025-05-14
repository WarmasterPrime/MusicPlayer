
class SongSearcher {
    
    static #algo;
    
    constructor() {
        
    }
    
    static #requestApiKey(callBackFunction) {
        let a={
            "src":"assets/php/SearchApi.php",
            "args":{
                "q":"request"
            }
        };
        Server.send(a, true, SongSearcher.#decodeApiKey);
    }
    
    static #requestDecodeAlgo() {
        let a={
            "src":"assets/php/EncodingAlgo.php",
            "args":{
                "q":"request"
            }
        };
        Server.send(a, true, SongSearcher.#updateAlgo);
    }
    /**
     * 
     * @param {string} algo The algorithm.
     */
    static #updateAlgo(algo) {
        SongSearcher.#algo=algo;
    }
    /**
     * Decodes the API key from the request.
     * @param {object} rawData 
     * @returns {string}
     */
    static #decodeApiKey(rawData) {
        let algo=rawData.algo;
        let data=rawData.data;
        let res="";
        for(let i=0;i<data.length;i++)
            res+=SongSearcher.#getChar(i, algo, data);
        return res;
    }
    /**
     * Decodes the api character.
     * @param {int} index The current index position in the data set.
     * @param {string} algo The algorithm used for the encoding.
     * @param {string} data The API key string.
     * @returns {string}
     */
    static #getChar(index, algo, data) {
        let i=index%algo.length;
        return String.fromCharCode(algo.charCodeAt(i)%2===0 ? data.charCodeAt(index)-algo.charCodeAt(i) : data.charCodeAt(index)+algo.charCodeAt(i));
    }
    
}
