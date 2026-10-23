export function createRouter(ids,onChange) {
  let current=ids[0];
  return {get current(){return current;},go(id){if(!ids.includes(id))return;current=id;onChange(id);},reset(){current=ids[0];}};
}
