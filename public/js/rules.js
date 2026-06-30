const RULES = {

    "Indoor 18m":{

        series:2,
        volleysPerSeries:10,
        arrowsPerVolley:3,

        allowed:["M","1","2","3","4","5","6","7","8","9","10"],

        shortcuts:{
            "+":"10"
        }

    },

    "Indoor 25m":{

        series:2,
        volleysPerSeries:10,
        arrowsPerVolley:3,

        allowed:["M","1","2","3","4","5","6","7","8","9","10"],

        shortcuts:{
            "+":"10"
        }

    },

    "Indoor 18+25":{

        series:4,
        volleysPerSeries:10,
        arrowsPerVolley:3,

        distances:[
            18,
            18,
            25,
            25
        ],

        allowed:["M","1","2","3","4","5","6","7","8","9","10"],

        shortcuts:{
            "+":"10"
        }

    },



    "Targa 18m":{
        series:2,
        volleysPerSeries:10,
        arrowsPerVolley:3,
        distances:[18,18],
        allowed:["M","1","2","3","4","5","6","7","8","9","10"],
        shortcuts:{ "+":"10" }
    },

    "Targa 25m":{
        series:2,
        volleysPerSeries:10,
        arrowsPerVolley:3,
        distances:[25,25],
        allowed:["M","1","2","3","4","5","6","7","8","9","10"],
        shortcuts:{ "+":"10" }
    },

    "Targa 18+25m":{
        series:4,
        volleysPerSeries:10,
        arrowsPerVolley:3,
        distances:[18,18,25,25],
        allowed:["M","1","2","3","4","5","6","7","8","9","10"],
        shortcuts:{ "+":"10" }
    },

    "Targa":{

        series:2,
        volleysPerSeries:6,
        arrowsPerVolley:6,

        allowed:[
            "M","1","2","3","4","5",
            "6","7","8","9","10","X"
        ],

        shortcuts:{
            "+":"10"
        }

    },

    "Doppio Targa":{

        series:4,
        volleysPerSeries:6,
        arrowsPerVolley:6,

        allowed:[
            "M","1","2","3","4","5",
            "6","7","8","9","10","X"
        ],

        shortcuts:{
            "+":"10"
        }

    },

    "Campagna/H&F 12+12":{

        targets:24,
        arrowsPerTarget:3,

        allowed:[
            "M","1","2","3","4","5","6"
        ]

    },

    "Campagna/H&F 24+24":{

        targets:48,
        arrowsPerTarget:3,

        allowed:[
            "M","1","2","3","4","5","6"
        ]

    },

    "3D 24":{

        targets:24,
        arrowsPerTarget:2,

        allowed:[
            "M","5","8","10","11"
        ],

        shortcuts:{
            "+":"10",
            "*":"11"
        }

    },

    "3D 48":{

        targets:48,
        arrowsPerTarget:2,

        allowed:[
            "M","5","8","10","11"
        ],

        shortcuts:{
            "+":"10",
            "*":"11"
        }

    }

};