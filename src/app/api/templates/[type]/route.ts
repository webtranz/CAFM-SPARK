import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";

const templates: Record<string, string> = {
  sites: "name,city,country,type,areaSqm\n",
  buildings: "code,name,site,city,country,floors,areaSqm\n",
  spaces: "code,name,site,city,country,buildingCode,floor,type,capacity,areaSqm,occupancy\n",
  locations: "code,site,zone,building,floor,room,type,parentLocation,locationClass,outOfService,residential,description,active\n",
  categories: "code,name,type,defaultLifeYrs,statutory,description\n",
  assets: "EQUIPMENTNO,EQUIPMENTDESC,ASSETSTATUS,EQTYPE,ORGANIZATION,COMMISSIONDATE,DEPARTMENT,DEPARTMENT_DESC,CLASS,CLASS_DESC,CATEGORY,CATEGORY_DESC,SERIALNUMBER,MODEL,MANUFACTURER,GSRC,ENDOFUSEFULLIFE,ATTRIBUTE,ENVIRONMENT,PRESSURE_BAR,FLOW_LPS,SUPPLY_VOLTAGE_Volt,OUTOFSERVICE,SERVICELIFE,LOCATION,LOCATION_DESC,POSITION,CLASSORGANIZATION,EQUIPMENTVALUE,PRIMARYSYSTEM,ADDITIONAL_NOTE\n",
  assetAllocations: "assetTag,departmentCode,assignedTeamCode,assignedSupervisorEmail,locationCode,buildingCode,floor,room,status,remarks\n",
  housingAssets: "Asset Code,Asset Name,Category,Description,Brand,Model,Serial Number,Status,Room Code,Room Number,Building Location,Room Location,Custodian Name,Custodian Contact,Issued To,Issued At,Transferred From,Transferred To,Transferred At,Replacement Of,Replaced At,PM Schedule,Next PM Due,Purchase Date,Supplier Name,Asset Value,Depreciation Rate,Current Value,Last Inspection At,Warranty Expiry,QR Code,Photo URLs,Movement Action,Notes\n",
  housingRooms: "type,code,roomCode,roomNumber,propertyCode,propertyName,blockCode,blockName,buildingNumber,floor,floorNumber,roomType,capacity,genderRestriction,status,sourceDescription,remarks\n",
  housingGuests: "type,residentNo,guestId,name,email,phone,companyId,companyName,gender,nationality,departmentCode,status,source\n",
  housingOccupancy: "type,bookingNo,reservationNumber,leaseNo,residentNo,guestId,residentName,guestName,roomCode,roomNumber,scheduledRoom,buildingNumber,floorNumber,roomType,checkIn,checkOut,sourceStatus,occupancyStatus,bookingStatus,ratePlan,bookingType,allocationType,requestedBy,priority,notes\n",
  departments: "code,name,siteLocation,description\n",
  employees: "name,email,companyId,nationalityType,departmentCode,siteLocation\n",
  teams: "name,companyIdNumber,departmentCode,service,email,phone\n",
  services: "code,serviceCode,departmentCode,name,category,type,priority,slaHours,teamCode,description,organization,equipmentUsability,equipmentUsabilityOrg,woClass,woClassOrg,sourceSheet\n",
  inventory: "sku,name,category,unit,onHand,reorderPoint,unitCost,vendor,location\n",
  requests: "ticketNo,title,category,departmentCode,serviceCode,assignedTeamCode,requester,channel,priority,status,location,attachmentUrls,rejectionReason,slaHours,description\n",
  workOrders: "woNo,title,type,assetType,departmentCode,serviceCode,assignedTeamCode,jobPlanCode,priority,status,assetTag,plannedStart,dueAt,finishedAt,resolutionAt,dateTimeCreated,estimatedHours,actualHours,cost,jobPlan,safetyNotes,workNotes,materialRequest,photoUrls,assetsUsed,inventoryUsed,supervisorDecision,sourceYear,sourceWorkOrder,sourceServiceRequest,sourceEquipmentLocation,sourceLocation,matchSource\n",
  cpmWorkOrders: "woNo,title,type,assetType,departmentCode,serviceCode,assignedTeamCode,jobPlanCode,priority,status,assetTag,plannedStart,dueAt,finishedAt,resolutionAt,dateTimeCreated,estimatedHours,actualHours,cost,jobPlan,safetyNotes,workNotes,materialRequest,photoUrls,assetsUsed,inventoryUsed,supervisorDecision\n",
  spmWorkOrders: "woNo,title,type,assetType,departmentCode,serviceCode,assignedTeamCode,jobPlanCode,priority,status,assetTag,plannedStart,dueAt,finishedAt,resolutionAt,dateTimeCreated,estimatedHours,actualHours,cost,jobPlan,safetyNotes,workNotes,materialRequest,photoUrls,assetsUsed,inventoryUsed,supervisorDecision\n",
  workOrderComments: "woNo,commentText,commentedAt,commentedBy,sourceYear,sourceLine,sourceUserCode\n",
  commentHistory: "woNo,commentText,commentedAt,commentedBy,sourceYear,sourceFile,sourceRow,sourceLine,sourceUserCode,sourceUpdateUserCode,add_entity,add_type,add_lang,add_print,add_updated,add_updatecount,uploadKey\n",
  jobPlans: "code,name,assetType,departmentCode,serviceCode,estimatedHours,priority,steps,safetyNotes\n",
  ppm: "code,ppmCode,uniqueCode,name,assetTag,locationCode,equipmentDescription,objectType,objectClass,objectCategory,frequency,periodUom,nextDue,durationHrs,departmentCode,priority,assignedTeamCode,technicianEmail,supervisorEmail,workflowStatus,checklistLink,checklist,active\n",
  ppmChecklistHistory: "SOURCE_YEAR,SOURCE_FILE,LINK_STATUS,SYSTEM_WORK_ORDER_MATCH,SYSTEM_ASSET_MATCH,SYSTEM_PPM_MATCH,UPLOAD_KEY,ACK_EVENT,EVT_CREATED,EVT_DESC,ACK_OBJECT,ACK_TYPE,ACK_CODE,ACK_ACT,ACK_SEQUENCE,ACK_DESC,ACK_NOTES,ACK_UPDATED,ACK_UPDATEDBY,ACK_UPDATECOUNT,ACK_OBJECT_ORG,ACK_YES,ACK_NO,ACK_FINDING,ACK_VALUE,ACK_UOM,ACK_FOLLOWUP,ACK_FOLLOWUPEVENT,ACK_LASTSAVED\n",
  omManuals: "category,assetTag,sourcePath,fileName,manualCode,manualTitle,matchField,assetClass,assetCategory,assetPrimarySystem,department\n",
  inspections: "code,title,area,inspector,risk,score,status,dueAt,findings\n",
  users: "name,email,phone,temporaryPassword,role,departmentCodes,supervisorEmail,teamCode,notifyWorkOrder,notifyFacilityBooking,active\n",
  roles: "name,description,standard\n",
  permissions: "role,permissionCode,permissionName,module,description,scope\n",
  documentLinks: "category,assetTag,fileName,fileUrl,fileSize,mimeType,checksum,uploadedBy,createdAt\n",
  auditHistory: "actorId,actorName,role,action,entity,entityId,details,createdAt\n",
};

export async function GET(_request: Request, { params }: { params: Promise<{ type: string }> }) {
  const { error } = await requireUser();
  if (error) return error;
  const { type } = await params;
  const body = templates[type] ?? templates.assets;
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${type}-template.csv"`,
    },
  });
}

