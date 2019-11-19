
start()


async function start(){
    //await one()
    //await two()
    //await three()
    //await four()
    //await five()
    //await six()
    await seven()
}

function one(){
    return new Promise(async (resolve) => {
    const maxvalue = 1000
    const three = 3
    const five = 5
    let sum = 0

    for(var i=1; i<maxvalue; i++){
        if(i % three == 0 || i % five == 0 ){
            sum += i
        }
    }

    console.log(sum)
    resolve()
})
}

function two(){
    return new Promise(async (resolve) => {
    
    let sum = 0
    let one = 1
    let two = 2     
    let three = 0   
    let max = 4000000  
    while(three <= max){ 
     
        three = one + two  
        if(three % 2 ==0){ 
            sum += three
        }
        one = two 
        two = three 
     
    }
    console.log(sum+2)
    
    resolve()
})
}

function three(){
    return new Promise(async (resolve) => {
    let value = 600851475143
    let one = 0
    
    for (var i = 3; i <= value; i++)    
    {
        if (value % i == 0)    
        {   
            one = i;    
            value /= i;    
        }                
    }
    console.log(one)
    resolve()
})
}

function four(){
    return new Promise(async (resolve) => {

    resolve()
})
}

function five(){
    let c = 20
    let count = 0
    let a = 0
    return new Promise(async (resolve) => {
    
    for(let i=20; ; i+=2){
        for(j=1;j<=20; j++){
            if(i%j===0){
                count++
            }
        }
        if(count === c){
            a = i
            break;
        }else{
            count = 0
        }
    }
    console.log(a)
    resolve()
})
}

function six(){
    let a = 10
    let b = 0
    let c = 0
    return new Promise(async (resolve) => {
    
        for(let i=1; i<=100;i++){
            b+=i
            c+=(i*i)
        }
        console.log((b*b)-c)
    resolve()
})
}

function seven(){
    let count = 0
    return new Promise(async (resolve) => {
    

    resolve()
})
}