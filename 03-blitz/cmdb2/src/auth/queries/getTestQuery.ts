import { resolver } from "@blitzjs/rpc";
import db, { Prisma } from "db";
import { Permission } from "shared/permissions";
import { sleep } from "shared/utils";


export default resolver.pipe(
    async (params: {}, ctx) => {



        const a: Prisma.EventArgs =
        {
            where: {
                AND: [
                    {
                        isDeleted: false
                    },
                    {
                        OR: [
                            {
                                visiblePermissionId: {
                                    in: [
                                        5,
                                        6,
                                        7,
                                        8,
                                        9,
                                        10,
                                        12,
                                        13,
                                        14,
                                        15,
                                        16,
                                        17,
                                        18,
                                        19,
                                        20,
                                        21,
                                        30
                                    ]
                                }
                            },
                            {
                                AND: [
                                    {
                                        visiblePermissionId: null
                                    },
                                    {
                                        createdByUserId: 1
                                    }
                                ]
                            }
                        ]
                    }
                ]
            },
            orderBy: [
                {
                    id: 'desc'
                }
            ],
            include: {
                status: true,
                visiblePermission: {
                    include: {
                        roles: true
                    }
                },
                createdByUser: true,
                songLists: {
                    include: {
                        event: true,
                        visiblePermission: {
                            include: {
                                roles: true
                            }
                        },
                        songs: {
                            include: {
                                song: {
                                    include: {
                                        visiblePermission: {
                                            include: {
                                                roles: true
                                            }
                                        },
                                        tags: {
                                            include: {
                                                tag: true
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                },
                tags: {
                    orderBy: [
                        {
                            eventTag: {
                                sortOrder: 'desc'
                            }
                        },
                        {
                            eventTag: {
                                text: 'asc'
                            }
                        },
                        {
                            eventTag: {
                                id: 'asc'
                            }
                        }
                    ],
                    include: {
                        eventTag: true
                    },
                    where: {
                        eventTag: undefined
                    }
                },
                type: true,
                comments: {
                    include: {
                        event: true,
                        user: true,
                        visiblePermission: {
                            include: {
                                roles: true
                            }
                        }
                    }
                },
                fileTags: {
                    include: {
                        file: {
                            include: {
                                visiblePermission: {
                                    include: {
                                        roles: true
                                    }
                                },
                                tags: {
                                    include: {
                                        fileTag: true
                                    }
                                },
                                taggedEvents: {
                                    include: {
                                        event: {
                                            include: {
                                                visiblePermission: {
                                                    include: {
                                                        roles: true
                                                    }
                                                }
                                            }
                                        }
                                    }
                                },
                                taggedInstruments: {
                                    include: {
                                        instrument: {
                                            include: {
                                                functionalGroup: true,
                                                instrumentTags: {
                                                    include: {
                                                        tag: true
                                                    },
                                                    orderBy: [
                                                        {
                                                            tag: {
                                                                sortOrder: 'desc'
                                                            }
                                                        },
                                                        {
                                                            tag: {
                                                                text: 'asc'
                                                            }
                                                        },
                                                        {
                                                            tag: {
                                                                id: 'asc'
                                                            }
                                                        }
                                                    ]
                                                }
                                            }
                                        }
                                    }
                                },
                                taggedSongs: {
                                    include: {
                                        song: {
                                            include: {
                                                visiblePermission: {
                                                    include: {
                                                        roles: true
                                                    }
                                                }
                                            }
                                        }
                                    }
                                },
                                taggedUsers: {
                                    include: {
                                        user: {
                                            select: {
                                                name: true,
                                                compactName: true
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    },
                    orderBy: {
                        file: {
                            uploadedAt: 'desc'
                        }
                    },
                    where: {
                        file: {
                            AND: [
                                {
                                    isDeleted: false
                                },
                                {
                                    OR: [
                                        {
                                            visiblePermissionId: {
                                                in: [
                                                    5,
                                                    6,
                                                    7,
                                                    8,
                                                    9,
                                                    10,
                                                    12,
                                                    13,
                                                    14,
                                                    15,
                                                    16,
                                                    17,
                                                    18,
                                                    19,
                                                    20,
                                                    21,
                                                    30
                                                ]
                                            }
                                        },
                                        {
                                            AND: [
                                                {
                                                    visiblePermissionId: null
                                                },
                                                {
                                                    uploadedByUserId: 1
                                                }
                                            ]
                                        }
                                    ]
                                }
                            ]
                        }
                    }
                },
                segments: {
                    orderBy: {
                        startsAt: 'desc'
                    },
                    include: {
                        event: true,
                        responses: {
                            include: {
                                attendance: true,
                                eventSegment: true,
                                instrument: {
                                    include: {
                                        functionalGroup: true,
                                        instrumentTags: {
                                            include: {
                                                tag: true
                                            },
                                            orderBy: [
                                                {
                                                    tag: {
                                                        sortOrder: 'desc'
                                                    }
                                                },
                                                {
                                                    tag: {
                                                        text: 'asc'
                                                    }
                                                },
                                                {
                                                    tag: {
                                                        id: 'asc'
                                                    }
                                                }
                                            ]
                                        }
                                    }
                                },
                                user: {
                                    include: {
                                        role: {
                                            include: {
                                                permissions: true
                                            }
                                        },
                                        instruments: {
                                            include: {
                                                instrument: {
                                                    include: {
                                                        functionalGroup: true,
                                                        instrumentTags: {
                                                            include: {
                                                                tag: true
                                                            },
                                                            orderBy: [
                                                                {
                                                                    tag: {
                                                                        sortOrder: 'desc'
                                                                    }
                                                                },
                                                                {
                                                                    tag: {
                                                                        text: 'asc'
                                                                    }
                                                                },
                                                                {
                                                                    tag: {
                                                                        id: 'asc'
                                                                    }
                                                                }
                                                            ]
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            },
            take: undefined
        };

        // {
        //     where: { id: 17 },
        //     include: {
        //         fileTags: {
        //             where: {
        //                 file: {
        //                     AND: [
        //                         { isDeleted: true }
        //                     ]
        //                 }
        //             }
        //         }
        //     }
        // }

        const x = db.event.findMany(a);

        return x;
    }
);



