# DXF Export Validation Checklist

- [ ] Exported DXF file exists
- [ ] Contains at least one `BorderZP*` layer if a closed border was present
- [ ] Contains `VBoreZ*` layers for drilled holes with depths
- [ ] Contains `RouterT*Z*` layers when router entities were assigned
- [ ] Entities are not duplicated (spot-check by opening in CAD)
