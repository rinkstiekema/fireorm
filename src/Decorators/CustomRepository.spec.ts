import { CustomRepository } from './CustomRepository';
import { BaseFirestoreRepository } from '../BaseFirestoreRepository';

const setRepository = jest.fn();
jest.mock('../MetadataUtils', () => ({
  getMetadataStorage: jest.fn().mockImplementation(() => ({
    setRepository,
  })),
}));

describe('CustomRepositoryDecorator', () => {
  beforeEach(() => {
    // MockedMetatadataStorage.
  });
  it('should call metadataStorage.setRepository with right params', () => {
    class Entity {
      id: string;
    }

    @CustomRepository(Entity)
    class EntityRepo extends BaseFirestoreRepository<Entity> {}

    expect(setRepository).toHaveBeenCalledWith({
      entity: Entity,
      target: EntityRepo,
    });
  });
});
